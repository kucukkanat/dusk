import { EventStore } from "applesauce-core";
import type { NostrEvent } from "applesauce-core/helpers/event";
import type { Filter } from "applesauce-core/helpers/filter";
import { RelayPool, RelayGroup, RelayLiveness } from "applesauce-relay";
import { markFromCache, isFromCache } from "applesauce-core/helpers/event";
import { createEventLoaderForStore } from "applesauce-loaders/loaders";
import { NostrConnectSigner } from "applesauce-signers";
import { NostrIDB, openDB } from "nostr-idb";
import { verifyEvent, verifiedSymbol } from "nostr-tools/pure";
import { BehaviorSubject, Observable, takeUntil, timer } from "rxjs";
import { getActivePubkey } from "../state/accounts";

/** Build-time override (VITE_RELAYS=ws://localhost:7777) so the app can run against a local test relay. */
const OVERRIDE = (import.meta.env.VITE_RELAYS as string | undefined)?.split(",").filter(Boolean);

/** Relays used when we know nothing else about a person. */
export const DEFAULT_RELAYS = OVERRIDE ?? ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];
/** Relays that index profiles, relay lists and contact lists for everyone. */
export const LOOKUP_RELAYS = OVERRIDE ?? ["wss://purplepag.es", "wss://user.kindpag.es", "wss://indexer.coracle.social"];
/** Relays that support NIP-50 search. */
export const SEARCH_RELAYS = OVERRIDE ?? ["wss://search.nos.today", "wss://relay.nostr.band", "wss://relay.ditto.pub"];

export const eventStore = new EventStore();
// a copy of an event we already hold is thrown away anyway; don't pay a schnorr check for it
eventStore.verifyEvent = (e) => eventStore.hasEvent(e.id) || verifyEvent(e);

export const pool = new RelayPool();

/* ---------- relay health ---------- */

/** Remembers relays that fail so we stop dialling dead ones on every request. */
export const liveness = new RelayLiveness({
  storage: {
    getItem: (k: string) => {
      try {
        return JSON.parse(localStorage.getItem("liveness:" + k) ?? "null");
      } catch {
        return null;
      }
    },
    setItem: (k: string, v: unknown) => {
      try {
        localStorage.setItem("liveness:" + k, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    },
  },
});
liveness.load().catch(() => {});
liveness.connectToPool(pool);

/** Drop relays known to be dead or in backoff (keeps the list if that would empty it). */
export function healthy(relays: string[]): string[] {
  const ok = liveness.filter(relays);
  return ok.length ? ok : relays;
}

/* ---------- quick requests ---------- */

export type QuickOpts = {
  /** How long to wait for the rest once the first relay has answered (ms) */
  settle?: number;
  /** Hard cap on the whole request (ms) */
  cap?: number;
};

/**
 * One-shot request that never hangs on slow or dead relays: skips unhealthy relays, finishes
 * `settle` ms after the first relay's EOSE (or when all have answered), and always ends by `cap`.
 * Events are added to the store.
 */
export function quick$(relays: string[], filters: Filter | Filter[], { settle = 800, cap = 3000 }: QuickOpts = {}): Observable<NostrEvent> {
  const complete = RelayGroup.completeOnAny(RelayGroup.completeAfterFirstRelay(settle), RelayGroup.completeOnAllEose());
  return pool
    .request(healthy(uniqRelays(relays)), filters as never, { eventStore, complete, timeout: cap } as never)
    .pipe(takeUntil(timer(cap)));
}

/** {@link quick$} as a promise of everything that arrived. */
export function quick(relays: string[], filters: Filter | Filter[], opts?: QuickOpts): Promise<NostrEvent[]> {
  return new Promise((resolve) => {
    const out: NostrEvent[] = [];
    quick$(relays, filters, opts).subscribe({ next: (e) => out.push(e), complete: () => resolve(out), error: () => resolve(out) });
  });
}
NostrConnectSigner.pool = pool;

/** The relays the active user reads from. Updated when their relay list (kind 10002) loads. */
export const readRelays$ = new BehaviorSubject<string[]>(DEFAULT_RELAYS);
export const writeRelays$ = new BehaviorSubject<string[]>(DEFAULT_RELAYS);

/* ---------- local cache (IndexedDB) ---------- */

let cache: NostrIDB | null = null;
const cacheReady = openDB("dusk")
  .then((db) => {
    cache = new NostrIDB(db, { maxEvents: 30000 });
    return cache.start().then(() => cache);
  })
  .catch((e) => {
    console.warn("Dusk: local cache unavailable", e);
    return null;
  });

/** Kinds that are cheap to keep and expensive to refetch. */
const CACHED_KINDS = new Set([0, 3, 5, 10000, 10002, 10003, 10050, 10063, 30000, 30023, 30311, 31922, 31923, 30009, 39089, 1, 6, 7, 16, 1068, 9735, 20, 1111]);
/** Kinds only worth keeping when they're about the signed-in user (the rest is a firehose). */
const MINE_ONLY = new Set([6, 7, 16, 9735]);

function worthCaching(event: NostrEvent) {
  if (!CACHED_KINDS.has(event.kind)) return false;
  const me = getActivePubkey();
  // other people's follow lists are big and only needed on demand
  if (event.kind === 3) return event.pubkey === me;
  if (MINE_ONLY.has(event.kind)) return !!me && event.tags.some((t) => t[0] === "p" && t[1] === me);
  return true;
}

eventStore.insert$.subscribe((event) => {
  // events read back from the cache are already there; writing them again re-indexes every tag
  if (isFromCache(event) || !worthCaching(event)) return;
  cacheReady.then((c) => c?.add(event as never)).catch(() => {});
});

export async function cacheRequest(filters: Filter[]): Promise<NostrEvent[]> {
  const c = await cacheReady;
  if (!c) return [];
  try {
    const events = (await c.query(filters as never)) as unknown as NostrEvent[];
    for (const e of events) {
      // we checked these before caching them; skip the signature check and the write-back
      (e as unknown as Record<symbol, boolean>)[verifiedSymbol] = true;
      markFromCache(e);
    }
    return events;
  } catch {
    return [];
  }
}

/** Load cached events into the store so screens render instantly before relays answer. */
export async function warmFromCache(filters: Filter[]) {
  const events = await cacheRequest(filters);
  for (const e of events) eventStore.add(e);
  return events;
}

export async function clearCache() {
  const c = await cacheReady;
  await c?.deleteAllEvents();
}

/* ---------- missing-event loader ---------- */

/** Kinds the indexers carry for everyone; ask them alongside read relays instead of after. */
const INDEXED_KINDS = new Set([0, 3, 10002]);

// the loader runs its steps one after another; each must end quickly or a dead hint stalls the rest
createEventLoaderForStore(
  eventStore,
  (relays: string[], filters: Filter[]) => {
    const indexed = filters.every((f) => f.kinds?.length && f.kinds.every((k) => INDEXED_KINDS.has(k)));
    return quick$(indexed ? uniqRelays(relays, LOOKUP_RELAYS) : relays, filters, { settle: 800, cap: 2500 });
  },
  { cacheRequest, lookupRelays: LOOKUP_RELAYS, extraRelays: readRelays$, followRelayHints: true, bufferTime: 400 },
);

/** Normalise a relay URL so duplicates compare equal. */
export function normalizeRelay(url: string): string | null {
  try {
    let u = url.trim();
    if (!/^wss?:\/\//i.test(u)) u = "wss://" + u;
    const p = new URL(u);
    if (p.protocol !== "wss:" && p.protocol !== "ws:") return null;
    let s = p.protocol + "//" + p.host.toLowerCase() + p.pathname;
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s + p.search;
  } catch {
    return null;
  }
}

export function uniqRelays(...lists: (string[] | undefined)[]): string[] {
  const out = new Set<string>();
  for (const l of lists) for (const r of l ?? []) {
    const n = normalizeRelay(r);
    if (n) out.add(n);
  }
  return [...out];
}

export const now = () => Math.floor(Date.now() / 1000);
