import { useEffect, useSyncExternalStore } from "react";
import type { NostrEvent } from "applesauce-core/helpers/event";
import type { Filter } from "applesauce-core/helpers/filter";
import { getOutboxes } from "applesauce-core/helpers/mailboxes";
import { selectOptimalRelays, groupPubkeysByRelay } from "applesauce-core/helpers/relay-selection";
import type { Subscription } from "rxjs";
import { eventStore, pool, readRelays$, uniqRelays, cacheRequest, DEFAULT_RELAYS, LOOKUP_RELAYS, now } from "./core";

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
    this.reqs.forEach((r) => r.unsubscribe());
    this.live?.unsubscribe();
    this.live = undefined;
    this.plan = null;
    this.seen.clear();
    this.set({ events: [], fresh: [], done: false, loadedOnce: false, error: undefined });
    await this.loadMore();
  }

  showFresh() {
    if (!this.state.fresh.length) return;
    const events = [...this.state.events];
    for (const e of this.state.fresh) this.insert(events, e);
    this.set({ events, fresh: [] });
  }

  async loadMore() {
    if (this.state.loading || this.state.done) return;
    this.set({ loading: true });
    let plan: RelayPlan;
    try {
      plan = await this.getPlan();
    } catch (e) {
      this.set({ loading: false, error: (e as Error).message, loadedOnce: true });
      return;
    }
    const relays = Object.keys(plan);
    if (!relays.length) {
      this.set({ loading: false, done: true, loadedOnce: true });
      return;
    }
    const until = this.state.events.length ? this.state.events[this.state.events.length - 1].created_at - 1 : undefined;
    const limit = this.spec.pageSize ?? 25;
    const page = (f: Filter): Filter => ({ ...f, limit, ...(until ? { until } : {}) });

    // render something from the local cache first
    if (!this.state.loadedOnce) {
      const all = Object.values(plan).flat().map(page);
      const cached = await cacheRequest(all.slice(0, 20));
      if (cached.length) {
        const events = [...this.state.events];
        for (const e of cached) {
          if (this.seen.has(e.id)) continue;
          const stored = eventStore.add(e) ?? e;
          if (!this.accept(stored)) continue;
          this.seen.add(e.id);
          this.insert(events, stored);
        }
        this.set({ events: events.slice(0, limit * 2) });
        // keep the cache only as a head start; relays decide what follows
        this.seen = new Set(this.state.events.map((e) => e.id));
      }
    }

    const got: NostrEvent[] = [];
    await new Promise<void>((resolve) => {
      let open = relays.length;
      const finish = () => {
        if (--open <= 0) resolve();
      };
      const timer = setTimeout(resolve, 8000);
      for (const relay of relays) {
        const sub = pool
          .relay(relay)
          .request(plan[relay].map(page), { timeout: 7000 })
          .subscribe({
            next: (e) => {
              const stored = eventStore.add(e, relay) ?? e;
              got.push(stored);
            },
            complete: finish,
            error: finish,
          });
        this.reqs.push(sub);
      }
      // resolve early once most relays have answered
      const early = setInterval(() => {
        if (open <= Math.floor(relays.length * 0.25) && got.length) {
          clearInterval(early);
          clearTimeout(timer);
          resolve();
        }
      }, 300);
      setTimeout(() => clearInterval(early), 8000);
    });

    // Relays answer with their own newest N; cut the page at the point where every relay is
    // still represented, so slow relays don't leave silent gaps.
    got.sort((a, b) => b.created_at - a.created_at);
    const events = [...this.state.events];
    let added = 0;
    const cut = got.length > limit ? got[Math.min(got.length - 1, limit * 2)].created_at : 0;
    for (const e of got) {
      if (e.created_at < cut) break;
      if (this.seen.has(e.id) || !this.accept(e)) continue;
      this.seen.add(e.id);
      this.insert(events, e);
      added++;
    }
    this.set({ events, loading: false, loadedOnce: true, done: added === 0 && got.length === 0 });
    if (!this.live && this.refs > 0 && this.spec.live !== false) this.startLive();
  }

  private startLive() {
    if (this.live || !this.plan) return;
    const since = now();
    const subs: Subscription[] = [];
    for (const [relay, filters] of Object.entries(this.plan)) {
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

/** Load relay lists for many people at once from the lookup relays (and cache). */
export async function loadRelayLists(pubkeys: string[], ms = 4000) {
  const missing = pubkeys.filter((p) => !eventStore.hasReplaceable(10002, p));
  if (!missing.length) return;
  const cached = await cacheRequest([{ kinds: [10002], authors: missing }]);
  cached.forEach((e) => eventStore.add(e));
  const still = missing.filter((p) => !eventStore.hasReplaceable(10002, p));
  if (!still.length) return;
  await requestAll(uniqRelays(LOOKUP_RELAYS, readRelays$.value), chunk(still, 400).map((authors) => ({ kinds: [10002], authors })), ms);
}

/** Load contact lists for many people (used for friends-of-friends and web of trust). */
export async function loadContactLists(pubkeys: string[], ms = 5000) {
  const missing = pubkeys.filter((p) => !eventStore.hasReplaceable(3, p));
  if (!missing.length) return;
  const cached = await cacheRequest([{ kinds: [3], authors: missing }]);
  cached.forEach((e) => eventStore.add(e));
  const still = missing.filter((p) => !eventStore.hasReplaceable(3, p));
  if (!still.length) return;
  await requestAll(uniqRelays(LOOKUP_RELAYS, readRelays$.value), chunk(still, 300).map((authors) => ({ kinds: [3], authors })), ms);
}

export function requestAll(relays: string[], filters: Filter[], ms = 5000): Promise<NostrEvent[]> {
  const out: NostrEvent[] = [];
  return new Promise((resolve) => {
    const sub = pool.request(relays, filters, { timeout: ms } as never).subscribe({
      next: (e) => {
        out.push(eventStore.add(e) ?? e);
      },
      complete: () => resolve(out),
      error: () => resolve(out),
    });
    setTimeout(() => {
      sub.unsubscribe();
      resolve(out);
    }, ms + 500);
  });
}

export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Outbox model: ask each author's own relays for their events, using as few connections as practical. */
export async function outboxPlan(authors: string[], base: BaseFilter, opts: { maxRelays?: number } = {}): Promise<RelayPlan> {
  if (!authors.length) return {};
  await loadRelayLists(authors);
  const users = authors.map((pubkey) => {
    const ev = eventStore.getReplaceable(10002, pubkey);
    const relays = ev ? uniqRelays(getOutboxes(ev)) : [];
    return { pubkey, relays: relays.length ? relays : readRelays$.value };
  });
  const selected = selectOptimalRelays(users, { maxConnections: opts.maxRelays ?? 18, maxRelaysPerUser: 2 });
  const byRelay = groupPubkeysByRelay(selected);
  // anyone left without a relay goes to our own read relays
  const covered = new Set(Object.values(byRelay).flatMap((ps) => ps.map((p) => p.pubkey)));
  const orphans = authors.filter((a) => !covered.has(a));
  const plan: RelayPlan = {};
  for (const [relay, ps] of Object.entries(byRelay)) {
    const pubkeys = ps.map((p) => p.pubkey);
    plan[relay] = chunk(pubkeys, 250).map((a) => ({ ...base, authors: a }));
  }
  if (orphans.length)
    for (const r of readRelays$.value)
      plan[r] = [...(plan[r] ?? []), ...chunk(orphans, 250).map((a) => ({ ...base, authors: a }))];
  return plan;
}

/** Same filter on a fixed set of relays. */
export function relaysPlan(relays: string[], filter: Filter): RelayPlan {
  const plan: RelayPlan = {};
  for (const r of uniqRelays(relays.length ? relays : DEFAULT_RELAYS)) plan[r] = [filter];
  return plan;
}
