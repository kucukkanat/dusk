import { useMemo } from "react";
import { filter, map, of, shareReplay, startWith, switchMap, tap, type Observable } from "rxjs";
import { use$ } from "applesauce-react/hooks";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { getContacts } from "applesauce-core/helpers/contacts";
import { getMutedThings, isHiddenMutesUnlocked, unlockHiddenMutes, type MutedThings } from "applesauce-common/helpers/mute";
import { getBookmarks, getHiddenBookmarks, isHiddenBookmarksUnlocked, unlockHiddenBookmarks, type BookmarkPointer } from "applesauce-common/helpers/bookmark";
import { FollowUser, UnfollowUser, MuteUser, UnmuteUser, MuteWord, UnmuteWord, MuteThread, UnmuteThread, MuteHashtag, UnmuteHashtag, AddUserToFollowSet, RemoveUserFromFollowSet, CreateFollowSet } from "applesauce-actions/actions";
import { eventStore } from "./core";
import { getReplaceableAddressForEvent } from "applesauce-core/helpers/pointers";
import { unlockHiddenTags, setHiddenTagsCache } from "applesauce-core/helpers/hidden-tags";
import { ContactsFactory } from "applesauce-common/factories";
import { publish } from "./publish";
import { activeSigner, ensureLatest, runAction } from "./actions";
import { useActivePubkey, getActivePubkey } from "../state/accounts";
import { toast, errorToast } from "../state/ui";

const EMPTY_MUTES: MutedThings = { pubkeys: new Set(), threads: new Set(), hashtags: new Set(), words: new Set() };
const unlocking = new Set<string>();

/** Decrypt the private part of a list once; unlocking notifies update$, which re-derives. */
function unlockOnce(ev: NostrEvent | undefined, isUnlocked: (e: NostrEvent) => boolean, unlock: (e: NostrEvent) => Promise<unknown>) {
  // only the active account's signer can decrypt
  if (!ev || ev.pubkey !== getActivePubkey() || !ev.content || isUnlocked(ev) || unlocking.has(ev.id)) return;
  unlocking.add(ev.id);
  unlock(ev)
    .then(() => eventStore.update(ev))
    .catch(() => {})
    .finally(() => unlocking.delete(ev.id));
}

const unlockMutes = (e: NostrEvent) => unlockHiddenMutes(e, activeSigner as never);
const unlockBookmarks = (e: NostrEvent) => unlockHiddenBookmarks(e, activeSigner as never);

/**
 * One shared, derived view of one of your own lists: subscribes to the store once per (kind, pubkey),
 * re-derives only when that list is replaced or updated (e.g. unlocked), never on unrelated update$.
 */
const ownLists = new Map<string, Observable<unknown>>();
function ownList$<T>(kind: number, pubkey: string, isUnlocked: (e: NostrEvent) => boolean, unlock: (e: NostrEvent) => Promise<unknown>, derive: (e: NostrEvent | undefined) => T): Observable<T> {
  const k = kind + ":" + pubkey;
  let o = ownLists.get(k) as Observable<T> | undefined;
  if (!o) {
    o = eventStore.replaceable(kind, pubkey).pipe(
      switchMap((ev) => (ev ? eventStore.update$.pipe(filter((u) => u.id === ev.id), map(() => ev), startWith(ev)) : of(undefined))),
      tap((ev) => unlockOnce(ev, isUnlocked, unlock)),
      map(derive),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    ownLists.set(k, o);
  }
  return o;
}

export function useMyContacts(): string[] {
  const me = useActivePubkey();
  const ev = use$(() => (me ? eventStore.replaceable(3, me) : undefined), [me]);
  return useMemo(() => (ev ? getContacts(ev).map((p) => p.pubkey) : []), [ev]);
}

/** One Set per kind-3 event, shared by every caller. */
const followSets = new WeakMap<NostrEvent, Set<string>>();
const NO_FOLLOWS = new Set<string>();
export function followSetOf(ev: NostrEvent | undefined): Set<string> {
  if (!ev) return NO_FOLLOWS;
  let s = followSets.get(ev);
  if (!s) followSets.set(ev, (s = new Set(getContacts(ev).map((p) => p.pubkey))));
  return s;
}

export function useFollowing(pubkey?: string | null): Set<string> {
  const ev = use$(() => (pubkey ? eventStore.replaceable(3, pubkey) : undefined), [pubkey]);
  return followSetOf(ev);
}

const mutes$ = (me: string) => ownList$(10000, me, isHiddenMutesUnlocked, unlockMutes, (ev) => (ev ? getMutedThings(ev) : EMPTY_MUTES));

export function useMyMutes(): MutedThings {
  const me = useActivePubkey();
  return use$(() => (me ? mutes$(me) : undefined), [me]) ?? EMPTY_MUTES;
}

/** Public and private (encrypted) bookmarks together, newest first. */
export function allBookmarks(ev: NostrEvent): BookmarkPointer[] {
  const seen = new Set<string>();
  const out: BookmarkPointer[] = [];
  for (const p of [...(getHiddenBookmarks(ev) ?? []), ...getBookmarks(ev)].reverse()) {
    const k = "id" in p ? p.id : `${p.kind}:${p.pubkey}:${p.identifier}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

type Bookmarks = { list: BookmarkPointer[]; set: Set<string> };
const NO_BOOKMARKS: Bookmarks = { list: [], set: new Set() };
const bookmarks$ = (me: string) =>
  ownList$<Bookmarks>(10003, me, isHiddenBookmarksUnlocked, unlockBookmarks, (ev) => {
    if (!ev) return NO_BOOKMARKS;
    const list = allBookmarks(ev);
    return { list, set: new Set(list.map((p) => ("id" in p ? p.id : `${p.kind}:${p.pubkey}:${p.identifier}`))) };
  });

function useBookmarks(): Bookmarks {
  const me = useActivePubkey();
  return use$(() => (me ? bookmarks$(me) : undefined), [me]) ?? NO_BOOKMARKS;
}

export function useBookmarkList(): BookmarkPointer[] {
  return useBookmarks().list;
}

export function useMyBookmarks(): Set<string> {
  return useBookmarks().set;
}

export function isMuted(ev: NostrEvent, m: MutedThings): boolean {
  if (m.pubkeys.has(ev.pubkey)) return true;
  if (m.threads.size) {
    if (m.threads.has(ev.id)) return true;
    for (const t of ev.tags) if (t[0] === "e" && m.threads.has(t[1])) return true;
  }
  if (m.hashtags.size) for (const t of ev.tags) if (t[0] === "t" && m.hashtags.has(t[1]?.toLowerCase())) return true;
  if (m.words.size) {
    const text = ev.content.toLowerCase();
    // mute words are stored lowercased (applesauce parseMutedTags)
    for (const w of m.words) if (w && text.includes(w)) return true;
  }
  return false;
}

/* ---------- edits (always fetch the newest list first) ---------- */

async function guardContacts() {
  const ev = await ensureLatest(3);
  if (!ev && !confirm("Dusk couldn't find your follow list on any server. Start a new one? (If you follow people from another app, cancel and check your servers first.)"))
    throw new Error("Cancelled");
}

export async function follow(pubkey: string) {
  try {
    await guardContacts();
    await runAction(FollowUser, pubkey);
  } catch (e) {
    if ((e as Error).message !== "Cancelled") errorToast(e, "Couldn't follow");
  }
}

export async function unfollow(pubkey: string) {
  try {
    await guardContacts();
    await runAction(UnfollowUser, pubkey);
  } catch (e) {
    if ((e as Error).message !== "Cancelled") errorToast(e, "Couldn't unfollow");
  }
}

/** Follow many people with a single contact-list update. */
export async function followMany(pubkeys: string[]) {
  await guardContacts();
  const me = getActivePubkey()!;
  const ev = eventStore.getReplaceable(3, me);
  const have = new Set(ev ? getContacts(ev).map((p) => p.pubkey) : []);
  let f = ev ? ContactsFactory.modify(ev as never) : ContactsFactory.create();
  for (const pk of pubkeys) if (!have.has(pk)) f = f.addContact(pk);
  await publish(await f);
}

export async function setMute(kind: "user" | "word" | "thread" | "tag", value: string, on: boolean) {
  try {
    await ensureLatest(10000);
    const hidden = true; // Dusk keeps mutes private
    if (kind === "user") await runAction(on ? MuteUser : UnmuteUser, value, hidden);
    else if (kind === "word") await runAction(on ? MuteWord : UnmuteWord, value, hidden);
    else if (kind === "thread") await runAction(on ? MuteThread : UnmuteThread, value, hidden);
    else await runAction(on ? MuteHashtag : UnmuteHashtag, value, hidden);
    if (!on) {
      // the item may also be in the public part; only touch it when it's actually there
      const name = { user: "p", word: "word", thread: "e", tag: "t" }[kind];
      const v = kind === "word" || kind === "tag" ? value.toLowerCase() : value;
      const me = getActivePubkey();
      const ev = me ? eventStore.getReplaceable(10000, me) : undefined;
      const inPublic = ev?.tags.some((t) => t[0] === name && (kind === "word" || kind === "tag" ? t[1]?.toLowerCase() : t[1]) === v);
      if (inPublic) {
        if (kind === "user") await runAction(UnmuteUser, value, false).catch(() => {});
        if (kind === "word") await runAction(UnmuteWord, value, false).catch(() => {});
        if (kind === "thread") await runAction(UnmuteThread, value, false).catch(() => {});
        if (kind === "tag") await runAction(UnmuteHashtag, value, false).catch(() => {});
      }
    }
  } catch (e) {
    errorToast(e, on ? "Couldn't mute" : "Couldn't unmute");
    throw e;
  }
}

/** Bookmark any event privately (NIP-51 kind 10003, encrypted to yourself). */
export async function setBookmark(ev: NostrEvent, on: boolean) {
  try {
    const me = getActivePubkey();
    if (!me) throw new Error("Sign in first");
    const list = await ensureLatest(10003);
    const addr = getReplaceableAddressForEvent(ev);
    const tag = addr ? ["a", addr] : ["e", ev.id];
    const same = (t: string[]) => t[0] === tag[0] && t[1] === tag[1];
    let hidden: string[][] = [];
    if (list?.content) {
      try {
        hidden = (await unlockHiddenTags(list as never, activeSigner as never)) as string[][];
      } catch {
        throw new Error("Couldn't read your private bookmarks with this signer");
      }
    }
    const publicTags = (list?.tags ?? []).filter((t) => !same(t));
    hidden = hidden.filter((t) => !same(t));
    if (on) hidden.push(tag);
    const plain = JSON.stringify(hidden);
    const content = hidden.length ? await activeSigner.nip44!.encrypt(me, plain) : "";
    const res = await publish({ kind: 10003, content, tags: publicTags }, { notifyTagged: false });
    // we already know what's inside; skip another decrypt prompt
    if (hidden.length) {
      setHiddenTagsCache(res.event as never, hidden as never);
      eventStore.update(res.event);
    }
    toast(on ? "Bookmarked" : "Removed from bookmarks");
  } catch (e) {
    errorToast(e, "Couldn't update bookmarks");
  }
}

export async function addToSet(pubkey: string, identifier: string, on: boolean) {
  try {
    await ensureLatest(30000, getActivePubkey(), identifier);
    await runAction(on ? AddUserToFollowSet : RemoveUserFromFollowSet, pubkey, identifier, false);
  } catch (e) {
    errorToast(e, "Couldn't update list");
  }
}

export async function createSet(title: string, pubkeys: string[] = []) {
  await runAction(CreateFollowSet, title, { public: pubkeys });
}
