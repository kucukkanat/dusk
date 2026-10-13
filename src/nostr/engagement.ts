import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { getReplaceableAddressForEvent } from "applesauce-core/helpers/pointers";
import { getZapAmount, getZapSender } from "applesauce-common/helpers/zap";
import { getNip10References } from "applesauce-common/helpers/threading";
import { eventStore, quick$, healthy, readRelays$, uniqRelays, DEFAULT_RELAYS } from "./core";
import { hintFor } from "./relays";
import { chunk } from "./timeline";
import { useActivePubkey } from "../state/accounts";

/* Batch requests for reactions, reposts, zaps and replies of the notes on screen. */
const queue = new Map<string, NostrEvent>();
const done = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const events = [...queue.values()];
  queue.clear();
  if (!events.length) return;
  const ids = events.filter((e) => !(e.kind >= 30000 && e.kind < 40000)).map((e) => e.id);
  const addrs = events.map((e) => getReplaceableAddressForEvent(e)).filter((a): a is string => !!a);
  // reactions usually land on the author's relays and on big relays: the most common author hints,
  // your read relays and two defaults, at most five live ones
  const hints = new Map<string, number>();
  for (const e of events) {
    const h = hintFor(e.pubkey);
    if (h) hints.set(h, (hints.get(h) ?? 0) + 1);
  }
  const top = [...hints.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([h]) => h);
  const relays = healthy(uniqRelays(top, readRelays$.value, DEFAULT_RELAYS.slice(0, 2))).slice(0, 5);
  const filters = [
    ...chunk(ids, 50).map((c) => ({ kinds: [1, 6, 7, 16, 9735, 1111], "#e": c, limit: 300 })),
    ...chunk(addrs, 50).map((c) => ({ kinds: [1, 7, 9735, 1111], "#a": c, limit: 300 })),
  ];
  if (!filters.length) return;
  quick$(relays, filters as never, { settle: 800, cap: 4000 }).subscribe({ error: () => {} });
}

export function requestEngagement(e: NostrEvent) {
  if (done.has(e.id)) return;
  done.add(e.id);
  queue.set(e.id, e);
  if (!timer) timer = setTimeout(flush, 600);
}

export type Engagement = {
  likes: number;
  reposts: number;
  replies: number;
  zaps: number;
  zapCount: number;
  myLike?: NostrEvent;
  myRepost?: NostrEvent;
  myZapped: boolean;
  reactions: Map<string, { count: number; url?: string; mine: boolean }>;
  reactionEvents: NostrEvent[];
  zapEvents: NostrEvent[];
};

/* ---------- one shared engagement index ---------- */

/**
 * Events referencing a note id (`#e`) or an address (`#a`), kept per key. Only keys someone asked
 * for are indexed; each is seeded from the store once, then updated incrementally from insert$/remove$.
 */
const KINDS = [1, 6, 7, 16, 9735, 1111];
const KIND_SET = new Set(KINDS);
type Bucket = { events: Map<string, NostrEvent>; ver: number; subs: Set<() => void> };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 3000;
let clock = 0;

function bucket(key: string): Bucket {
  let b = buckets.get(key);
  if (b) return b;
  b = { events: new Map(), ver: ++clock, subs: new Set() };
  const tag = key.includes(":") ? "#a" : "#e";
  for (const r of eventStore.getByFilters({ kinds: KINDS, [tag]: [key] } as never)) b.events.set(r.id, r);
  buckets.set(key, b);
  // forget the oldest keys nobody is watching
  if (buckets.size > MAX_BUCKETS)
    for (const [k, x] of buckets) {
      if (buckets.size <= MAX_BUCKETS * 0.8) break;
      if (!x.subs.size) buckets.delete(k);
    }
  return b;
}

const dirty = new Set<Bucket>();
let notifyTimer: ReturnType<typeof setTimeout> | null = null;
function notify() {
  notifyTimer = null;
  const subs = new Set<() => void>();
  for (const b of dirty) for (const s of b.subs) subs.add(s);
  dirty.clear();
  for (const s of subs) s();
}

function index(r: NostrEvent, add: boolean) {
  if (!KIND_SET.has(r.kind)) return;
  for (const t of r.tags) {
    if ((t[0] !== "e" && t[0] !== "a") || !t[1]) continue;
    const b = buckets.get(t[1]);
    if (!b) continue;
    if (add) {
      if (b.events.has(r.id)) continue;
      b.events.set(r.id, r);
    } else if (!b.events.delete(r.id)) continue;
    b.ver = ++clock;
    if (b.subs.size) dirty.add(b);
  }
  // coalesce bursts of relay messages into one render
  if (dirty.size && !notifyTimer) notifyTimer = setTimeout(notify, 50);
}
eventStore.insert$.subscribe((r) => index(r, true));
eventStore.remove$.subscribe((r) => index(r, false));

/** The reacted-to note is the last e tag. */
function lastE(r: NostrEvent) {
  for (let i = r.tags.length - 1; i >= 0; i--) if (r.tags[i][0] === "e") return r.tags[i][1];
  return undefined;
}

function compute(id: string, addr: string | null, me: string | undefined, bs: Bucket[]): Engagement {
  const out: Engagement = { likes: 0, reposts: 0, replies: 0, zaps: 0, zapCount: 0, myZapped: false, reactions: new Map(), reactionEvents: [], zapEvents: [] };
  let related: NostrEvent[];
  if (bs.length === 1) related = [...bs[0].events.values()];
  else {
    const m = new Map<string, NostrEvent>();
    for (const b of bs) for (const [k, v] of b.events) m.set(k, v);
    related = [...m.values()];
  }
  // newest first, like the store's timelines
  related.sort((a, b) => b.created_at - a.created_at);
  const seenReactors = new Set<string>();
  for (const r of related) {
    if (r.kind === 7) {
      const target = lastE(r);
      if (target && target !== id && !addr) continue;
      const key = r.pubkey + ":" + r.content;
      if (seenReactors.has(key)) continue;
      seenReactors.add(key);
      out.reactionEvents.push(r);
      const c = r.content === "+" || r.content === "" ? "+" : r.content;
      if (c === "-") continue;
      out.likes++;
      const emojiUrl = c.startsWith(":") ? r.tags.find((t) => t[0] === "emoji" && `:${t[1]}:` === c)?.[2] : undefined;
      const cur = out.reactions.get(c) ?? { count: 0, url: emojiUrl, mine: false };
      cur.count++;
      if (r.pubkey === me) {
        cur.mine = true;
        out.myLike = r;
      }
      out.reactions.set(c, cur);
    } else if (r.kind === 6 || r.kind === 16) {
      out.reposts++;
      if (r.pubkey === me) out.myRepost = r;
    } else if (r.kind === 9735) {
      const amt = getZapAmount(r);
      if (amt) {
        out.zaps += Math.round(amt / 1000);
        out.zapCount++;
        out.zapEvents.push(r);
        if (getZapSender(r) === me) out.myZapped = true;
      }
    } else if (r.kind === 1) {
      const refs = getNip10References(r);
      const parent = refs.reply?.e?.id ?? refs.root?.e?.id;
      if (parent === id) out.replies++;
      else if (r.tags.some((t) => t[0] === "q" && t[1] === id)) out.reposts++;
    } else if (r.kind === 1111) out.replies++;
  }
  return out;
}

const EMPTY: Engagement = { likes: 0, reposts: 0, replies: 0, zaps: 0, zapCount: 0, myZapped: false, reactions: new Map(), reactionEvents: [], zapEvents: [] };
const noSub = () => () => {};

export function useEngagement(e: NostrEvent | undefined, load = true): Engagement {
  const me = useActivePubkey() ?? undefined;
  useEffect(() => {
    if (e && load) requestEngagement(e);
  }, [e, load]);
  const id = e?.id;
  const addr = e ? getReplaceableAddressForEvent(e) : null;
  const src = useMemo(() => {
    if (!id) return null;
    const keys = addr ? [addr, id] : [id];
    let cache: { ver: string; me?: string; out: Engagement } | null = null;
    return {
      subscribe: (cb: () => void) => {
        const bs = keys.map(bucket);
        for (const b of bs) b.subs.add(cb);
        return () => {
          for (const b of bs) b.subs.delete(cb);
        };
      },
      get: (me: string | undefined) => {
        const bs = keys.map(bucket);
        const ver = bs.map((b) => b.ver).join();
        if (!cache || cache.ver !== ver || cache.me !== me) cache = { ver, me, out: compute(id, addr, me, bs) };
        return cache.out;
      },
    };
  }, [id, addr]);
  return useSyncExternalStore(src ? src.subscribe : noSub, () => (src ? src.get(me) : EMPTY));
}
