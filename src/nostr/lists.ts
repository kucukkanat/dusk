import { useEffect, useMemo } from "react";
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

/** Decrypt the private part of a list once, then nudge subscribers. */
function useUnlock(ev: NostrEvent | undefined, isUnlocked: (e: NostrEvent) => boolean, unlock: (e: NostrEvent) => Promise<unknown>) {
  useEffect(() => {
    if (!ev || !ev.content || isUnlocked(ev) || unlocking.has(ev.id)) return;
    unlocking.add(ev.id);
    unlock(ev)
      .then(() => eventStore.update(ev))
      .catch(() => {})
      .finally(() => unlocking.delete(ev.id));
  }, [ev, isUnlocked, unlock]);
}

const unlockMutes = (e: NostrEvent) => unlockHiddenMutes(e, activeSigner as never);
const unlockBookmarks = (e: NostrEvent) => unlockHiddenBookmarks(e, activeSigner as never);

export function useMyContacts(): string[] {
  const me = useActivePubkey();
  const ev = use$(() => (me ? eventStore.replaceable(3, me) : undefined), [me]);
  return useMemo(() => (ev ? getContacts(ev).map((p) => p.pubkey) : []), [ev]);
}

export function useFollowing(pubkey?: string | null): Set<string> {
  const ev = use$(() => (pubkey ? eventStore.replaceable(3, pubkey) : undefined), [pubkey]);
  return useMemo(() => new Set(ev ? getContacts(ev).map((p) => p.pubkey) : []), [ev]);
}

export function useMyMutes(): MutedThings {
  const me = useActivePubkey();
  const ev = use$(() => (me ? eventStore.replaceable(10000, me) : undefined), [me]);
  // re-read after update$ fires for the unlocked event
  const tick = use$(() => eventStore.update$, []);
  useUnlock(ev, isHiddenMutesUnlocked, unlockMutes);
  return useMemo(() => (ev ? getMutedThings(ev) : EMPTY_MUTES), [ev, tick]); // eslint-disable-line react-hooks/exhaustive-deps
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

export function useBookmarkList(): BookmarkPointer[] {
  const me = useActivePubkey();
  const ev = use$(() => (me ? eventStore.replaceable(10003, me) : undefined), [me]);
  const tick = use$(() => eventStore.update$, []);
  useUnlock(ev, isHiddenBookmarksUnlocked, unlockBookmarks);
  return useMemo(() => (ev ? allBookmarks(ev) : []), [ev, tick]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useMyBookmarks(): Set<string> {
  const me = useActivePubkey();
  const ev = use$(() => (me ? eventStore.replaceable(10003, me) : undefined), [me]);
  const tick = use$(() => eventStore.update$, []);
  useUnlock(ev, isHiddenBookmarksUnlocked, unlockBookmarks);
  return useMemo(() => {
    const s = new Set<string>();
    if (ev)
      for (const p of allBookmarks(ev)) {
        if ("id" in p) s.add(p.id);
        else s.add(`${p.kind}:${p.pubkey}:${p.identifier}`);
      }
    return s;
  }, [ev, tick]); // eslint-disable-line react-hooks/exhaustive-deps
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
    for (const w of m.words) if (w && text.includes(w.toLowerCase())) return true;
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
      // the item may also be in the public part
      if (kind === "user") await runAction(UnmuteUser, value, false).catch(() => {});
      if (kind === "word") await runAction(UnmuteWord, value, false).catch(() => {});
      if (kind === "thread") await runAction(UnmuteThread, value, false).catch(() => {});
      if (kind === "tag") await runAction(UnmuteHashtag, value, false).catch(() => {});
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
