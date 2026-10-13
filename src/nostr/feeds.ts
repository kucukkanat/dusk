import type { NostrEvent } from "applesauce-core/helpers/event";
import { getContacts } from "applesauce-core/helpers/contacts";
import { getNip10References } from "applesauce-common/helpers/threading";
import type { Feed } from "../state/settings";
import { eventStore, readRelays$, uniqRelays, DEFAULT_RELAYS } from "./core";
import { loadContactLists, outboxPlan, relaysPlan, type TimelineSpec } from "./timeline";
import { ensureLatest } from "./actions";

export const NOTE_KINDS = [1, 6, 16, 20, 1068];

/** True for kind-1 notes that reply to something. */
export function isReply(e: NostrEvent) {
  if (e.kind !== 1) return false;
  const refs = getNip10References(e);
  return !!(refs.reply || refs.root);
}

const topLevel = (e: NostrEvent) => !isReply(e);

export async function myContacts(me: string): Promise<string[]> {
  let ev = eventStore.getReplaceable(3, me);
  if (!ev) ev = await ensureLatest(3, me);
  return ev ? getContacts(ev).map((p) => p.pubkey) : [];
}

/** People followed by the people you follow, most-followed first. */
export async function friendsOfFriends(me: string, max = 300): Promise<string[]> {
  const follows = await myContacts(me);
  await loadContactLists(follows.slice(0, 600));
  const mine = new Set([me, ...follows]);
  const score = new Map<string, number>();
  for (const f of follows) {
    const ev = eventStore.getReplaceable(3, f);
    if (!ev) continue;
    for (const p of getContacts(ev)) if (!mine.has(p.pubkey)) score.set(p.pubkey, (score.get(p.pubkey) ?? 0) + 1);
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([p]) => p);
}

export function feedSpec(feed: Feed, me: string | null): TimelineSpec {
  const key = `feed:${feed.src}:${feed.tag ?? feed.relay ?? feed.set ?? ""}:${me ?? "anon"}`;
  switch (feed.src) {
    case "following":
      return {
        key,
        accept: topLevel,
        plan: async () => {
          if (!me) return relaysPlan(DEFAULT_RELAYS, { kinds: [1, 6] });
          const follows = await myContacts(me);
          return outboxPlan([...follows, me], { kinds: NOTE_KINDS });
        },
      };
    case "fof":
      return {
        key,
        accept: topLevel,
        plan: async () => {
          if (!me) return {};
          return outboxPlan(await friendsOfFriends(me), { kinds: [1, 20] }, { maxRelays: 12 });
        },
      };
    case "global":
      return { key, accept: topLevel, plan: async () => relaysPlan(readRelays$.value, { kinds: [1, 6, 20] }) };
    case "tag": {
      const t = (feed.tag ?? "").toLowerCase();
      return { key, plan: async () => relaysPlan(uniqRelays(readRelays$.value, DEFAULT_RELAYS), { kinds: [1, 20, 30023], "#t": [t] }) };
    }
    case "long":
      return {
        key,
        pageSize: 15,
        plan: async () => {
          if (!me) return relaysPlan(uniqRelays(DEFAULT_RELAYS, ["wss://nostr.wine"]), { kinds: [30023] });
          return outboxPlan(await myContacts(me), { kinds: [30023] });
        },
      };
    case "pictures":
      return {
        key,
        plan: async () => {
          if (!me) return relaysPlan(DEFAULT_RELAYS, { kinds: [20] });
          return outboxPlan(await myContacts(me), { kinds: [20] });
        },
      };
    case "video":
      return {
        key,
        plan: async () => {
          if (!me) return relaysPlan(DEFAULT_RELAYS, { kinds: [21, 22] });
          return outboxPlan(await myContacts(me), { kinds: [21, 22, 34235, 34236] });
        },
      };
    case "relay":
      return { key, accept: topLevel, plan: async () => relaysPlan([feed.relay ?? DEFAULT_RELAYS[0]], { kinds: [1, 6, 20] }) };
    case "set":
      return {
        key,
        accept: topLevel,
        plan: async () => {
          if (!me || !feed.set) return {};
          const ev = eventStore.getReplaceable(30000, me, feed.set) ?? (await ensureLatest(30000, me, feed.set));
          const authors = ev ? ev.tags.filter((t) => t[0] === "p").map((t) => t[1]) : [];
          return outboxPlan(authors, { kinds: NOTE_KINDS });
        },
      };
  }
}

export function profileSpec(pubkey: string, tab: "notes" | "replies" | "media" | "articles"): TimelineSpec {
  const key = `profile:${pubkey}:${tab}`;
  if (tab === "articles") return { key, pageSize: 15, plan: () => outboxPlan([pubkey], { kinds: [30023] }) };
  if (tab === "media") return { key, plan: () => outboxPlan([pubkey], { kinds: [20, 21, 22] }) };
  return {
    key,
    pageSize: 30,
    accept: tab === "notes" ? topLevel : isReply,
    plan: () => outboxPlan([pubkey], { kinds: tab === "notes" ? NOTE_KINDS : [1] }),
  };
}

export function hashtagSpec(tag: string): TimelineSpec {
  return feedSpec({ id: "tag:" + tag, name: "#" + tag, src: "tag", tag }, null);
}
