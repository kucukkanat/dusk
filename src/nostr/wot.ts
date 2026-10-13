import { useEffect, useSyncExternalStore } from "react";
import { getContacts } from "applesauce-core/helpers/contacts";
import { eventStore } from "./core";
import { loadContactLists } from "./timeline";
import { useActivePubkey } from "../state/accounts";
import { useFollowing } from "./lists";
import { useSettings } from "../state/settings";

/* one web of trust for the whole app: every component that asks shares the download and the set */
let loadedFor: string | null = null;
let loading: string | null = null;
let tick = 0;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn));
const getTick = () => tick;
let built: { key: string; set: Set<string> } | null = null;

function load(key: string, follows: Set<string>) {
  if (loadedFor === key || loading === key) return;
  loading = key;
  const list = [...follows].slice(0, 500);
  loadContactLists(list)
    .then(() => {
      // nothing arrived means the network failed; leave it unloaded so the next mount retries
      if (list.some((p) => eventStore.hasReplaceable(3, p))) loadedFor = key;
    })
    .catch(() => {})
    .finally(() => {
      if (loading === key) loading = null;
      tick++;
      listeners.forEach((l) => l());
    });
}

function wotSet(me: string, follows: Set<string>, key: string): Set<string> {
  const k = key + ":" + tick;
  if (built?.key === k) return built.set;
  const s = new Set<string>([me, ...follows]);
  for (const f of follows) {
    const ev = eventStore.getReplaceable(3, f);
    if (ev) for (const p of getContacts(ev)) s.add(p.pubkey);
  }
  built = { key: k, set: s };
  return s;
}

/**
 * Web of trust: you, the people you follow, and the people they follow.
 * Returns null when filtering is off or nobody is signed in (show everything).
 */
export function useWot(): Set<string> | null {
  const me = useActivePubkey();
  const on = useSettings((s) => s.wot);
  const follows = useFollowing(me);
  useSyncExternalStore(subscribe, getTick);
  const key = me ? me + ":" + (eventStore.getReplaceable(3, me)?.id ?? "") : "";
  useEffect(() => {
    if (on && me && follows.size) load(key, follows);
  }, [on, me, follows, key]);
  // until follows load, don't hide anything
  if (!on || !me || !follows.size) return null;
  return wotSet(me, follows, key);
}
