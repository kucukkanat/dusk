import { useEffect, useSyncExternalStore } from "react";
import type { NostrEvent } from "applesauce-core/helpers/event";
import type { Filter } from "applesauce-core/helpers/filter";
import { getOutboxes } from "applesauce-core/helpers/mailboxes";
import { selectOptimalRelays, groupPubkeysByRelay } from "applesauce-core/helpers/relay-selection";
import type { Subscription } from "rxjs";
import { matchFilter } from "applesauce-core/helpers/filter";
import { eventStore, pool, readRelays$, uniqRelays, cacheRequest, healthy, liveness, quick, quick$, DEFAULT_RELAYS, LOOKUP_RELAYS, now } from "./core";

/** A filter without authors/since/until; the loader adds those. */
export type BaseFilter = Omit<Filter, "since" | "until" | "authors" | "limit">;

/** A relay plan: which filter goes to which relay. */
export type RelayPlan = Record<string, Filter[]>;

export type TimelineSpec = {
  key: string;
  /** Builds the relay plan. Called once per load (so follows can change). */
  plan: () => Promise<RelayPlan>;
  /** Drop events the UI should not show in this timeline (e.g. replies). */
  accept?: (e: NostrEvent) => boolean;
  pageSize?: number;
  live?: boolean;
};

type State = { events: NostrEvent[]; fresh: NostrEvent[]; loading: boolean; done: boolean; error?: string; loadedOnce: boolean };

const EMPTY: State = { events: [], fresh: [], loading: false, done: false, loadedOnce: false };

/** Keeps one timeline: the visible list, notes that arrived live, paging and the live subscription. */
export class Timeline {
  state: State = EMPTY;
  private listeners = new Set<() => void>();
  private seen = new Set<string>();
  private plan: RelayPlan | null = null;
  /** Fetched but not shown yet: older than what every relay has been asked for. Newest first. */
  private buffer: NostrEvent[] = [];
  private buffered = new Set<string>();
  /** Per relay: the oldest timestamp it has given us; everything newer from it is already here. */
  private floors = new Map<string, number>();
  /** Relays with nothing older to give (or that keep failing). */
  private exhausted = new Set<string>();
  private misses = new Map<string, number>();
  /** Bumped by refresh so pages still in flight drop their results. */
  private gen = 0;
  private live?: Subscription;
  private reqs: Subscription[] = [];
  private refs = 0;
  private spec: TimelineSpec;

  constructor(spec: TimelineSpec) {
    this.spec = spec;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.state;

  private set(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  private accept(e: NostrEvent) {
    return this.spec.accept ? this.spec.accept(e) : true;
  }

  private insert(list: NostrEvent[], e: NostrEvent) {
    // keep newest first; most inserts land near one end
    let i = list.length;
    while (i > 0 && list[i - 1].created_at < e.created_at) i--;
    list.splice(i, 0, e);
  }

  attach() {
    this.refs++;
    if (this.refs === 1) {
      if (!this.state.loadedOnce) this.loadMore();
      else this.startLive();
    }
  }

  detach() {
    this.refs = Math.max(0, this.refs - 1);
    if (this.refs === 0) {
      this.live?.unsubscribe();
      this.live = undefined;
    }
  }

  private async getPlan() {
    if (!this.plan) this.plan = await this.spec.plan();
    return this.plan;
  }

  async refresh() {
    this.gen++;
    this.reqs.forEach((r) => r.unsubscribe());
    this.reqs = [];
    this.live?.unsubscribe();
    this.live = undefined;
    this.plan = null;
    this.buffer = [];
    this.buffered.clear();
    this.floors.clear();
    this.exhausted.clear();
    this.misses.clear();
    this.seen.clear();
    this.set({ events: [], fresh: [], loading: false, done: false, loadedOnce: false, error: undefined });
    await this.loadMore();
  }

  showFresh() {
    if (!this.state.fresh.length) return;
    const events = [...this.state.events];
    for (const e of this.state.fresh) this.insert(events, e);
    this.set({ events, fresh: [] });
  }

  async loadMore(fill = 0, shown = 0): Promise<void> {
    if (this.state.loading || this.state.done) return;
    const gen = this.gen;
    this.set({ loading: true });
    let plan: RelayPlan;
    try {
      plan = await this.getPlan();
    } catch (e) {
      if (gen === this.gen) this.set({ loading: false, error: (e as Error).message, loadedOnce: true });
      return;
    }
    if (gen !== this.gen) return;
    const active = healthy(Object.keys(plan)).filter((r) => !this.exhausted.has(r));
    if (!active.length && !this.buffer.length) {
      this.set({ loading: false, done: true, loadedOnce: true });
      return;
    }
    const limit = this.spec.pageSize ?? 25;
    const first = !this.state.loadedOnce;
    // relays already deeper than the next page's worth of buffered events don't need asking again
    const target = this.buffer.length >= limit ? this.buffer[limit - 1].created_at : -Infinity;
    const ask = active.filter((r) => !this.floors.has(r) || this.floors.get(r)! >= target);
    const page = (r: string) => {
      const until = this.floors.get(r);
      return plan[r].map((f): Filter => ({ ...f, limit, ...(until !== undefined ? { until } : {}) }));
    };

    // the local cache gives a head start while relays answer
    let settled = false;
    if (first && ask.length)
      cacheRequest(ask.flatMap(page).slice(0, 20)).then((cached) => {
        if (settled || gen !== this.gen || !cached.length) return;
        const events = [...this.state.events];
        for (const e of cached.sort((a, b) => b.created_at - a.created_at).slice(0, limit * 2)) {
          if (this.seen.has(e.id)) continue;
          const stored = eventStore.add(e) ?? e;
          this.seen.add(e.id);
          if (this.accept(stored)) this.insert(events, stored);
        }
        this.set({ events });
      });

    const got = new Map<string, NostrEvent[]>();
    const answered = new Set<string>();
    if (ask.length)
      await new Promise<void>((resolve) => {
        const subs: Subscription[] = [];
        let open = ask.length;
        let ended = false;
        let any = false;
        let grace: ReturnType<typeof setTimeout> | null = null;
        const end = () => {
          if (ended) return;
          ended = true;
          clearTimeout(timer);
          if (grace) clearTimeout(grace);
          subs.forEach((s) => s.unsubscribe());
          this.reqs = this.reqs.filter((r) => !subs.includes(r));
          resolve();
        };
        // don't let one slow or dead relay hold the page: once one has answered, give the rest a moment
        const finish = (relay: string, ok: boolean) => {
          if (ended) return;
          if (ok) answered.add(relay);
          if (--open <= 0) return end();
          if (ok && !grace) grace = setTimeout(end, any ? 1200 : 1500);
        };
        const timer = setTimeout(end, 8000);
        for (const relay of ask) {
          const list: NostrEvent[] = [];
          got.set(relay, list);
          const sub = pool
            .relay(relay)
            .request(page(relay), { timeout: 7000 })
            .subscribe({
              next: (e) => {
                if (ended) return;
                any = true;
                list.push(eventStore.add(e, relay) ?? e);
              },
              complete: () => finish(relay, true),
              error: () => finish(relay, false),
            });
          if (ended) sub.unsubscribe();
          else {
            subs.push(sub);
            this.reqs.push(sub);
          }
        }
      });
    settled = true;
    if (gen !== this.gen) return;

    for (const relay of ask) {
      const list = got.get(relay) ?? [];
      for (const e of list)
        if (!this.seen.has(e.id) && !this.buffered.has(e.id)) {
          this.buffered.add(e.id);
          this.buffer.push(e);
        }
      if (!answered.has(relay)) {
        // a relay that keeps failing would hold the timeline at its floor forever
        const m = (this.misses.get(relay) ?? 0) + 1;
        this.misses.set(relay, m);
        if (m >= 2) this.exhausted.add(relay);
        continue;
      }
      this.misses.delete(relay);
      // each filter got its own newest `limit`; the relay is only complete down to the shallowest of them.
      // (some relays cap `limit` lower than we ask, so a short answer of 50+ isn't taken as the end)
      let floor = -Infinity;
      for (const f of plan[relay]) {
        const mine = list.filter((e) => matchFilter(f, e));
        if (mine.length >= Math.min(limit, 50)) floor = Math.max(floor, Math.min(...mine.map((e) => e.created_at)));
      }
      if (floor === -Infinity) {
        this.exhausted.add(relay);
        continue;
      }
      const prev = this.floors.get(relay);
      // `until` is inclusive; step past a second that holds a whole page so we can't loop on it
      this.floors.set(relay, prev !== undefined && floor >= prev ? prev - 1 : floor);
    }
    this.buffer.sort((a, b) => b.created_at - a.created_at);

    // show everything newer than the shallowest relay floor: below it some relay may still have notes we haven't seen
    const bound = healthy(Object.keys(plan)).filter((r) => !this.exhausted.has(r) && this.floors.has(r));
    const safe = bound.length ? Math.max(...bound.map((r) => this.floors.get(r)!)) : -Infinity;
    const events = [...this.state.events];
    let added = 0;
    let i = 0;
    for (; i < this.buffer.length && this.buffer[i].created_at >= safe; i++) {
      const e = this.buffer[i];
      this.buffered.delete(e.id);
      if (this.seen.has(e.id)) continue;
      this.seen.add(e.id);
      if (!this.accept(e)) continue;
      this.insert(events, e);
      added++;
    }
    this.buffer.splice(0, i);
    const done = !this.buffer.length && Object.keys(plan).every((r) => this.exhausted.has(r) || !active.includes(r));
    this.set({ events, loading: false, loadedOnce: true, done });
    if (!this.live && this.refs > 0 && this.spec.live !== false) this.startLive();
    // a page can be mostly things this timeline hides (replies, or only replies); keep going so the screen fills
    const total = shown + added;
    if (!done && total < limit / 2 && fill < 3 && this.refs > 0 && (answered.size || !ask.length)) return this.loadMore(fill + 1, total);
  }

  private startLive() {
    if (this.live || !this.plan) return;
    const since = now();
    const subs: Subscription[] = [];
    for (const relay of healthy(Object.keys(this.plan))) {
      const filters = this.plan[relay];
      subs.push(
        pool
          .relay(relay)
          .subscription(filters.map((f) => ({ ...f, since })))
          .subscribe({
            next: (msg) => {
              if (msg === "EOSE") return;
              const e = eventStore.add(msg, relay) ?? msg;
              if (this.seen.has(e.id) || !this.accept(e)) return;
              this.seen.add(e.id);
              if (!this.state.events.length) {
                const events = [e];
                this.set({ events });
              } else {
                const fresh = [e, ...this.state.fresh].sort((a, b) => b.created_at - a.created_at);
                this.set({ fresh });
              }
            },
            error: () => {},
          }),
      );
    }
    this.live = { unsubscribe: () => subs.forEach((s) => s.unsubscribe()) } as Subscription;
  }

  /** Put an event the user just published at the top. */
  prepend(e: NostrEvent) {
    if (this.seen.has(e.id) || !this.accept(e)) return;
    this.seen.add(e.id);
    this.set({ events: [e, ...this.state.events] });
  }
}

const timelines = new Map<string, Timeline>();

export function getTimeline(spec: TimelineSpec) {
  let t = timelines.get(spec.key);
  if (!t) {
    t = new Timeline(spec);
    timelines.set(spec.key, t);
  }
  return t;
}

export function forgetTimelines(prefix?: string) {
  for (const k of [...timelines.keys()]) if (!prefix || k.startsWith(prefix)) timelines.delete(k);
}

export function allTimelines() {
  return [...timelines.values()];
}

export function useTimeline(spec: TimelineSpec | null) {
  const t = spec ? getTimeline(spec) : null;
  useEffect(() => {
    if (!t) return;
    t.attach();
    return () => t.detach();
  }, [t]);
  const state = useSyncExternalStore(t ? t.subscribe : noopSub, t ? t.getSnapshot : emptySnap);
  return { ...state, timeline: t };
}
const noopSub = () => () => {};
const emptySnap = () => EMPTY;

/* ---------- relay plans ---------- */

/** People with no relay list, so we don't look them up on every plan and every launch. */
const NO_RELAYS_KEY = "dusk:no10002";
const NO_RELAYS_TTL = 24 * 3600_000;
let noRelays: Map<string, number> | null = null;
function noRelayList() {
  if (!noRelays) {
    noRelays = new Map();
    try {
      const t = Date.now() - NO_RELAYS_TTL;
      for (const [p, at] of Object.entries(JSON.parse(localStorage.getItem(NO_RELAYS_KEY) ?? "{}") as Record<string, number>))
        if (at > t) noRelays.set(p, at);
    } catch {
      /* ignore */
    }
  }
  return noRelays;
}
function rememberNoRelays(pubkeys: string[]) {
  const m = noRelayList();
  const at = Date.now();
  for (const p of pubkeys) m.set(p, at);
  try {
    localStorage.setItem(NO_RELAYS_KEY, JSON.stringify(Object.fromEntries(m)));
  } catch {
    /* ignore */
  }
}

/** Load relay lists for many people at once from the lookup relays (and cache). Never waits longer than `ms`. */
export async function loadRelayLists(pubkeys: string[], ms = 1500) {
  const none = noRelayList();
  const t = Date.now() - NO_RELAYS_TTL;
  const missing = pubkeys.filter((p) => !eventStore.hasReplaceable(10002, p) && !((none.get(p) ?? 0) > t));
  if (!missing.length) return;
  const cached = await cacheRequest([{ kinds: [10002], authors: missing }]);
  cached.forEach((e) => eventStore.add(e));
  const still = missing.filter((p) => !eventStore.hasReplaceable(10002, p));
  if (!still.length) return;
  const relays = uniqRelays(LOOKUP_RELAYS, readRelays$.value);
  const filters = chunk(still, 400).map((authors) => ({ kinds: [10002], authors }));
  const start = Date.now();
  await new Promise<void>((resolve) => {
    // for a profile or two, stop as soon as everyone's list is in
    const few = still.length <= 3;
    let sub: Subscription | undefined;
    let all = false;
    sub = quick$(relays, filters, { settle: 600, cap: ms }).subscribe({
      next: () => {
        if (!few || !still.every((p) => eventStore.hasReplaceable(10002, p))) return;
        all = true;
        sub?.unsubscribe();
        resolve();
      },
      complete: () => resolve(),
      error: () => resolve(),
    });
    if (all) sub.unsubscribe();
  });
  // only trust "not found" when relays actually answered rather than us running out of time
  if (Date.now() - start < ms - 50) rememberNoRelays(still.filter((p) => !eventStore.hasReplaceable(10002, p)));
}

const contactsInFlight = new Map<string, Promise<void>>();
/** People with no follow list on the indexers, and when we found out. */
const noContacts = new Map<string, number>();
const NO_CONTACTS_TTL = 30 * 60_000;

/** Load contact lists for many people (used for friends-of-friends and web of trust). Shares downloads already in flight. */
export async function loadContactLists(pubkeys: string[], ms = 5000) {
  const t = Date.now() - NO_CONTACTS_TTL;
  const waits = new Set<Promise<void>>();
  const todo: string[] = [];
  for (const p of pubkeys) {
    if (eventStore.hasReplaceable(3, p) || (noContacts.get(p) ?? 0) > t) continue;
    const w = contactsInFlight.get(p);
    if (w) waits.add(w);
    else todo.push(p);
  }
  if (todo.length) {
    const job = fetchContactLists(todo, ms);
    for (const p of todo) contactsInFlight.set(p, job);
    job.finally(() => todo.forEach((p) => contactsInFlight.get(p) === job && contactsInFlight.delete(p)));
    waits.add(job);
  }
  await Promise.all(waits);
}

async function fetchContactLists(pubkeys: string[], ms: number) {
  const cached = await cacheRequest([{ kinds: [3], authors: pubkeys }]);
  cached.forEach((e) => eventStore.add(e));
  const still = pubkeys.filter((p) => !eventStore.hasReplaceable(3, p));
  if (!still.length) return;
  const start = Date.now();
  // two indexers carry nearly everyone; follow lists are heavy, so don't ask every relay for them
  await quick(LOOKUP_RELAYS.slice(0, 2), chunk(still, 100).map((authors) => ({ kinds: [3], authors })), { settle: 1500, cap: ms });
  if (Date.now() - start < ms - 50) {
    const at = Date.now();
    for (const p of still) if (!eventStore.hasReplaceable(3, p)) noContacts.set(p, at);
  }
}

/** One-shot request to many relays; `ms` caps how long it can take. */
export function requestAll(relays: string[], filters: Filter[], ms = 5000): Promise<NostrEvent[]> {
  return quick(relays, filters, { settle: 1200, cap: ms });
}

export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Outbox model: ask each author's own relays for their events, using as few connections as practical. */
export async function outboxPlan(
  authors: string[],
  base: BaseFilter,
  opts: { maxRelays?: number; maxRelaysPerUser?: number } = {},
): Promise<RelayPlan> {
  if (!authors.length) return {};
  await loadRelayLists(authors);
  const read = healthy(readRelays$.value);
  const users = authors.map((pubkey) => {
    const ev = eventStore.getReplaceable(10002, pubkey);
    const relays = ev ? liveness.filter(uniqRelays(getOutboxes(ev))) : [];
    return { pubkey, relays: relays.length ? relays : read };
  });
  const selected = selectOptimalRelays(users, {
    maxConnections: opts.maxRelays ?? 12,
    maxRelaysPerUser: authors.length <= 3 ? 4 : (opts.maxRelaysPerUser ?? 2),
  });
  const byRelay = groupPubkeysByRelay(selected);
  // anyone left without a relay goes to our own read relays
  const covered = new Set(Object.values(byRelay).flatMap((ps) => ps.map((p) => p.pubkey)));
  const orphans = authors.filter((a) => !covered.has(a));
  const plan: RelayPlan = {};
  for (const [relay, ps] of Object.entries(byRelay)) {
    const pubkeys = ps.map((p) => p.pubkey);
    plan[relay] = chunk(pubkeys, 150).map((a) => ({ ...base, authors: a }));
  }
  if (orphans.length)
    for (const r of read)
      plan[r] = [...(plan[r] ?? []), ...chunk(orphans, 150).map((a) => ({ ...base, authors: a }))];
  return plan;
}

/** Same filter on a fixed set of relays. */
export function relaysPlan(relays: string[], filter: Filter): RelayPlan {
  const plan: RelayPlan = {};
  for (const r of uniqRelays(relays.length ? relays : DEFAULT_RELAYS)) plan[r] = [filter];
  return plan;
}
