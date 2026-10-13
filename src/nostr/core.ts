import { EventStore } from "applesauce-core";
import type { NostrEvent } from "applesauce-core/helpers/event";
import type { Filter } from "applesauce-core/helpers/filter";
import { RelayPool } from "applesauce-relay";
import { createEventLoaderForStore } from "applesauce-loaders/loaders";
import { NostrConnectSigner } from "applesauce-signers";
import { WalletConnect } from "applesauce-wallet-connect";
import { NostrIDB, openDB } from "nostr-idb";
import { verifyEvent } from "nostr-tools/pure";
import { BehaviorSubject } from "rxjs";

/** Build-time override (VITE_RELAYS=ws://localhost:7777) so the app can run against a local test relay. */
const OVERRIDE = (import.meta.env.VITE_RELAYS as string | undefined)?.split(",").filter(Boolean);

/** Relays used when we know nothing else about a person. */
export const DEFAULT_RELAYS = OVERRIDE ?? ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];
/** Relays that index profiles, relay lists and contact lists for everyone. */
export const LOOKUP_RELAYS = OVERRIDE ?? ["wss://purplepag.es", "wss://user.kindpag.es", "wss://indexer.coracle.social"];
/** Relays that support NIP-50 search. */
export const SEARCH_RELAYS = OVERRIDE ?? ["wss://search.nos.today", "wss://relay.nostr.band", "wss://relay.ditto.pub"];

export const eventStore = new EventStore();
eventStore.verifyEvent = verifyEvent;

export const pool = new RelayPool();
NostrConnectSigner.pool = pool;
WalletConnect.pool = pool;

/** The relays the active user reads from. Updated when their relay list (kind 10002) loads. */
export const readRelays$ = new BehaviorSubject<string[]>(DEFAULT_RELAYS);
export const writeRelays$ = new BehaviorSubject<string[]>(DEFAULT_RELAYS);

/* ---------- local cache (IndexedDB) ---------- */

let cache: NostrIDB | null = null;
const cacheReady = openDB("dusk")
  .then((db) => {
    cache = new NostrIDB(db);
    return cache.start().then(() => cache);
  })
  .catch((e) => {
    console.warn("Dusk: local cache unavailable", e);
    return null;
  });

/** Kinds that are cheap to keep and expensive to refetch. */
const CACHED_KINDS = new Set([0, 3, 5, 10000, 10002, 10003, 10050, 10063, 30000, 30023, 30311, 31922, 31923, 30009, 39089, 1, 6, 7, 16, 1068, 9735, 20, 1111]);

eventStore.insert$.subscribe((event) => {
  if (!CACHED_KINDS.has(event.kind)) return;
  cacheReady.then((c) => c?.add(event as never)).catch(() => {});
});

export async function cacheRequest(filters: Filter[]): Promise<NostrEvent[]> {
  const c = await cacheReady;
  if (!c) return [];
  try {
    return (await c.query(filters as never)) as unknown as NostrEvent[];
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

createEventLoaderForStore(eventStore, pool, {
  cacheRequest,
  lookupRelays: LOOKUP_RELAYS,
  extraRelays: readRelays$,
  followRelayHints: true,
  bufferTime: 400,
});

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
