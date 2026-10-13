import { useEffect, useMemo, useState } from "react";
import { getContacts } from "applesauce-core/helpers/contacts";
import { eventStore } from "./core";
import { loadContactLists } from "./timeline";
import { useActivePubkey } from "../state/accounts";
import { useFollowing } from "./lists";
import { useSettings } from "../state/settings";

let loadedFor: string | null = null;

/**
 * Web of trust: you, the people you follow, and the people they follow.
 * Returns null when filtering is off or nobody is signed in (show everything).
 */
export function useWot(): Set<string> | null {
  const me = useActivePubkey();
  const on = useSettings((s) => s.wot);
  const follows = useFollowing(me);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!on || !me || !follows.size || loadedFor === me) return;
    loadedFor = me;
    loadContactLists([...follows].slice(0, 500)).then(() => setTick((t) => t + 1));
  }, [on, me, follows]);
  return useMemo(() => {
    if (!on || !me) return null;
    const s = new Set<string>([me, ...follows]);
    for (const f of follows) {
      const ev = eventStore.getReplaceable(3, f);
      if (ev) for (const p of getContacts(ev)) s.add(p.pubkey);
    }
    // until follows load, don't hide anything
    return follows.size ? s : null;
  }, [on, me, follows, tick]);
}
