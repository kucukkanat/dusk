import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { BehaviorSubject, type Subscription } from "rxjs";
import { create } from "zustand";
import { use$ } from "applesauce-react/hooks";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { getContacts } from "applesauce-core/helpers/contacts";
import { getZapAmount, getZapSender, getZapRequest } from "applesauce-common/helpers/zap";
import { getNip10References } from "applesauce-common/helpers/threading";
import { eventStore, pool, readRelays$, uniqRelays, warmFromCache, quick$, DEFAULT_RELAYS, now } from "./core";
import { useActivePubkey } from "../state/accounts";
import { useSettings, getSettings } from "../state/settings";
import { lsGet, lsSet } from "../lib/kv";
import { displayName } from "./profile";

export type NotifKind = "like" | "repost" | "zap" | "reply" | "mention" | "quote" | "follow";
export type Notif = {
  id: string;
  kind: NotifKind;
  who: string[];
  /** The note this is about (yours for likes/reposts/zaps; theirs for replies and mentions) */
  target?: string;
  event: NostrEvent;
  amount?: number;
  comment?: string;
  emoji?: string;
  t: number;
  unread: boolean;
};

const KINDS = [1, 6, 7, 16, 9735, 1111, 3];
const DAYS14 = 14 * 86400;

type ReadState = { lastRead: number; unreadIds: string[]; readIds: string[] };
const saved = lsGet<ReadState & { followers?: string[] }>("notifread", { lastRead: 0, unreadIds: [], readIds: [] });
export const useNotifRead = create<ReadState & { markAll: () => void; toggle: (id: string, unread: boolean) => void }>()((set, get) => ({
  lastRead: saved.lastRead,
  unreadIds: saved.unreadIds,
  readIds: saved.readIds,
  markAll: () => {
    set({ lastRead: now(), unreadIds: [], readIds: [] });
    persist(get());
  },
  toggle: (id, unread) => {
    const s = get();
    set({
      unreadIds: unread ? [...s.unreadIds, id] : s.unreadIds.filter((x) => x !== id),
      readIds: unread ? s.readIds.filter((x) => x !== id) : [...s.readIds, id].slice(-500),
    });
    persist(get());
  },
}));
function persist(s: ReadState) {
  lsSet("notifread", { lastRead: s.lastRead, unreadIds: s.unreadIds, readIds: s.readIds });
}

/* followers live under their own key: thousands of keys we don't want to rewrite on every tap */
const followers = new Set<string>(lsGet<string[] | null>("notiffollowers", null) ?? saved.followers ?? []);
if (saved.followers) {
  lsSet("notiffollowers", [...followers]);
  persist(saved);
}
let followersTimer: ReturnType<typeof setTimeout> | undefined;

/** Whether the first notification request after sign-in (or an account switch) is still running. */
export const useNotifLoading = create<{ loading: boolean }>()(() => ({ loading: false }));

const seenKey = (me: string) => "notifseen:" + me;
const filtersFor = (me: string, since: number, limit?: number) => [
  // separate limits so the reaction firehose can't crowd out replies and zaps, and big follow lists can't crowd out anything
  { kinds: [1, 1111], "#p": [me], since, limit: limit ?? 200 },
  { kinds: [9735], "#p": [me], since, limit: limit ?? 100 },
  { kinds: [7, 6, 16], "#p": [me], since, limit: limit ?? 300 },
  { kinds: [3], "#p": [me], since, limit: limit ?? 50 },
];

/** Listen for anything that mentions the signed-in person, on their inbox relays and the big public ones. */
export function useNotificationFeed() {
  const me = useActivePubkey();
  const read = use$(readRelays$);
  const relays = useMemo(() => uniqRelays(read, DEFAULT_RELAYS), [read]);
  const ctx = useRef<{ relays$: BehaviorSubject<string[]>; queried: Set<string>; since: Promise<number>; bump: (t: number) => void } | null>(null);

  useEffect(() => {
    if (!me) return;
    const start = relays;
    const relays$ = new BehaviorSubject(start);
    const queried = new Set(start);
    let newest = lsGet<number>(seenKey(me), 0);
    const bump = (t: number) => {
      if (t > newest && t <= now() + 60) newest = t;
    };
    const save = () => lsSet(seenKey(me), newest);
    const subs: Subscription[] = [];
    // only ask relays for what came in since we last looked; fall back to two weeks when the cache can't cover the gap
    const since = warmFromCache(filtersFor(me, now() - DAYS14, 500)).then((cached) => (cached.length && newest ? Math.max(newest - 3600, now() - DAYS14) : now() - DAYS14));
    ctx.current = { relays$, queried, since, bump };
    useNotifLoading.setState({ loading: true });
    let alive = true;
    since.then((s) => {
      if (!alive) return;
      subs.push(
        quick$(start, filtersFor(me, s), { settle: 1500, cap: 10000 }).subscribe({
          next: (e) => bump(e.created_at),
          complete: () => (save(), useNotifLoading.setState({ loading: false })),
          error: () => useNotifLoading.setState({ loading: false }),
        }),
      );
    });
    // one live REQ per relay; relays joining later are added without reopening the others
    subs.push(
      pool.subscription(relays$, { kinds: KINDS, "#p": [me], since: now() }).subscribe({
        next: (e) => {
          const stored = eventStore.add(e) ?? e;
          bump(e.created_at);
          save();
          maybeAlert(stored, me);
        },
        error: () => {},
      }),
    );
    return () => {
      alive = false;
      ctx.current = null;
      useNotifLoading.setState({ loading: false });
      for (const s of subs) s.unsubscribe();
      relays$.complete();
    };
  }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = ctx.current;
    if (!me || !c) return;
    if (c.relays$.value.join(",") !== relays.join(",")) c.relays$.next(relays);
    const fresh = relays.filter((r) => !c.queried.has(r));
    if (!fresh.length) return;
    for (const r of fresh) c.queried.add(r);
    // runs to its cap even if relays change again, so these relays aren't marked queried but skipped
    c.since.then((s) => {
      if (ctx.current === c) quick$(fresh, filtersFor(me, s), { settle: 1500, cap: 10000 }).subscribe({ next: (e) => c.bump(e.created_at), error: () => {} });
    });
  }, [me, relays]);
}

function inQuietHours() {
  const h = new Date().getHours();
  return h >= 22 || h < 7;
}

function maybeAlert(e: NostrEvent, me: string) {
  if (e.pubkey === me || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;
  const s = getSettings();
  if (s.notif.quiet && inQuietHours()) return;
  const kind = classify(e, me);
  if (!kind) return;
  if ((kind === "reply" || kind === "mention" || kind === "quote") && !s.notif.mentions) return;
  if (kind === "zap" && !s.notif.zaps) return;
  if ((kind === "like" || kind === "repost") && !s.notif.likes) return;
  if (kind === "follow") return; // follow lists change often; don't buzz for them
  const who = kind === "zap" ? (getZapSender(e) ?? e.pubkey) : e.pubkey;
  const name = displayName(who);
  const text = { like: "liked your note", repost: "reposted your note", zap: "zapped you", reply: "replied to you", mention: "mentioned you", quote: "quoted your note", follow: "followed you" }[kind];
  try {
    navigator.serviceWorker?.ready.then((reg) => reg.showNotification("Dusk", { body: `${name} ${text}`, icon: "./icons/icon-192.png", tag: e.id }));
  } catch {
    /* ignore */
  }
}

function classify(e: NostrEvent, me: string): NotifKind | null {
  switch (e.kind) {
    case 7:
      return e.content === "-" ? null : "like";
    case 6:
    case 16:
      return "repost";
    case 9735:
      return "zap";
    case 3:
      return getContacts(e).some((p) => p.pubkey === me) ? "follow" : null;
    case 1111:
      return "reply";
    case 1: {
      if (e.tags.some((t) => t[0] === "q")) {
        const q = e.tags.find((t) => t[0] === "q")?.[1];
        const qe = q ? eventStore.getEvent(q) : undefined;
        if (qe?.pubkey === me) return "quote";
      }
      const refs = getNip10References(e);
      if (refs.reply || refs.root) {
        const parentId = refs.reply?.e?.id ?? refs.root?.e?.id;
        const parent = parentId ? eventStore.getEvent(parentId) : undefined;
        if (!parent || parent.pubkey === me) return "reply";
      }
      return "mention";
    }
  }
  return null;
}

function targetOf(e: NostrEvent, kind: NotifKind): string | undefined {
  if (kind === "like" || kind === "repost") return [...e.tags].reverse().find((t) => t[0] === "e")?.[1];
  if (kind === "zap") return e.tags.find((t) => t[0] === "e")?.[1];
  if (kind === "quote") return e.tags.find((t) => t[0] === "q")?.[1];
  return e.id;
}

/* ---------- shared, computed once per change ---------- */

type Snap = { items: Notif[]; unread: number; unreadNoLikes: number };
const EMPTY: Snap = { items: [], unread: 0, unreadNoLikes: 0 };
let store: { me: string; events: NostrEvent[]; snap: Snap; sub: Subscription } | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function compute(me: string, events: NostrEvent[]): Snap {
  const read = useNotifRead.getState();
  const unreadIds = new Set(read.unreadIds);
  const readIds = new Set(read.readIds);
  const groups = new Map<string, Notif>();
  const out: Notif[] = [];
  for (const e of events) {
    if (e.pubkey === me && e.kind !== 9735) continue;
    const kind = classify(e, me);
    if (!kind) continue;
    if (kind === "follow" && followers.has(e.pubkey) && e.created_at < read.lastRead) continue;
    const who: string | undefined = kind === "zap" ? getZapSender(e) : e.pubkey;
    if (!who || who === me) continue;
    const target = targetOf(e, kind);
    const unread = unreadIds.has(e.id) || (!readIds.has(e.id) && e.created_at > read.lastRead);
    if (kind === "like" || kind === "repost") {
      const gk = kind + ":" + target;
      const g = groups.get(gk);
      if (g) {
        if (!g.who.includes(who)) g.who.push(who);
        g.unread = g.unread || unread;
        continue;
      }
      const n: Notif = { id: e.id, kind, who: [who], target, event: e, t: e.created_at, unread, emoji: kind === "like" && e.content !== "+" ? e.content : undefined };
      groups.set(gk, n);
      out.push(n);
      continue;
    }
    const n: Notif = { id: e.id, kind, who: [who], target, event: e, t: e.created_at, unread };
    if (kind === "zap") {
      n.amount = Math.round((getZapAmount(e) ?? 0) / 1000);
      n.comment = getZapRequest(e)?.content;
    }
    out.push(n);
  }
  out.sort((a, b) => b.t - a.t);
  let unread = 0;
  let unreadNoLikes = 0;
  for (const n of out)
    if (n.unread) {
      unread++;
      if (n.kind !== "like" && n.kind !== "repost") unreadNoLikes++;
    }
  return { items: out, unread, unreadNoLikes };
}

function recompute() {
  timer = undefined;
  if (!store) return;
  store.snap = compute(store.me, store.events);
  for (const l of listeners) l();
}
/** Coalesce bursts (hundreds of events arriving at once) into one regroup. */
const schedule = () => (timer ??= setTimeout(recompute, 50));

function snapFor(me: string | null | undefined): Snap {
  if (!me) return EMPTY;
  if (store?.me !== me) {
    store?.sub.unsubscribe();
    const s = { me, events: [] as NostrEvent[], snap: EMPTY, sub: undefined as unknown as Subscription };
    store = s;
    let first = true;
    s.sub = eventStore.timeline({ kinds: KINDS, "#p": [me] }).subscribe((events) => {
      s.events = events;
      if (first) s.snap = compute(me, events);
      else schedule();
    });
    first = false;
  }
  return store.snap;
}
useNotifRead.subscribe(() => store && recompute());

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function useNotifSnap(): Snap {
  const me = useActivePubkey();
  return useSyncExternalStore(subscribe, () => snapFor(me));
}

export function useNotifications(): Notif[] {
  return useNotifSnap().items;
}

export function useUnreadActivityCount() {
  const snap = useNotifSnap();
  const likes = useSettings((s) => s.notif.likes);
  return likes ? snap.unread : snap.unreadNoLikes;
}

export function useHasUnreadActivity() {
  return useUnreadActivityCount() > 0;
}

/** Remember who followed us so their next follow-list edit doesn't show up again. */
export function rememberFollowers(pubkeys: string[]) {
  let added = false;
  for (const p of pubkeys)
    if (!followers.has(p)) {
      followers.add(p);
      added = true;
    }
  if (!added) return;
  clearTimeout(followersTimer);
  followersTimer = setTimeout(() => {
    const all = [...followers];
    if (all.length > 5000) {
      followers.clear();
      for (const p of all.slice(-5000)) followers.add(p);
    }
    lsSet("notiffollowers", [...followers]);
  }, 2000);
}
