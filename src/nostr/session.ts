import { useEffect } from "react";
import { getInboxes, getOutboxes } from "applesauce-core/helpers/mailboxes";
import { DEFAULT_RELAYS, LOOKUP_RELAYS, eventStore, pool, quick$, healthy, readRelays$, writeRelays$, uniqRelays, warmFromCache } from "./core";
import { useActivePubkey, getSigner, useAccounts } from "../state/accounts";
import { markLive, markSyncing } from "./actions";

/** Kinds that describe the signed-in person: profile, follows, mutes, relays, bookmarks, DM relays, media servers, follow sets, emoji. */
export const SELF_KINDS = [0, 3, 10000, 10002, 10003, 10030, 10050, 10063, 30000, 30030, 39089];

/** Keeps the signed-in person's own lists fresh and points reads and writes at their relays. */
export function useSession() {
  const me = useActivePubkey();
  const accounts = useAccounts((s) => s.accounts);

  useEffect(() => {
    if (!me) {
      readRelays$.next(DEFAULT_RELAYS);
      writeRelays$.next(DEFAULT_RELAYS);
      return;
    }
    let cancelled = false;
    const subs: { unsubscribe(): void }[] = [];
    let resolveSync!: () => void;
    markSyncing(me, new Promise<void>((r) => (resolveSync = r)));

    warmFromCache([{ kinds: SELF_KINDS, authors: [me] }]).then(() => {
      if (cancelled) return;
      const mine = eventStore.getReplaceable(10002, me);
      // indexers and big relays, plus our own outboxes when we already know them
      const sub = quick$(uniqRelays(LOOKUP_RELAYS, DEFAULT_RELAYS, mine ? getOutboxes(mine) : []), { kinds: SELF_KINDS, authors: [me] }, { settle: 800, cap: 4000 }).subscribe({
        error: () => synced(),
        // from here the live subscription below keeps these current, so edits can trust the store
        complete: () => synced(),
      });
      subs.push(sub);
    });
    const synced = () => {
      if (!cancelled) markLive(me, true);
      resolveSync();
    };

    // follow the relay list: point reads and writes at it, and keep listening there for changes made elsewhere
    let live: { unsubscribe(): void } | null = null;
    let liveKey = "";
    const listen = (relays: string[]) => {
      const key = [...relays].sort().join(",");
      if (key === liveKey) return;
      liveKey = key;
      live?.unsubscribe();
      live = pool
        .subscription(relays, { kinds: SELF_KINDS, authors: [me], since: Math.floor(Date.now() / 1000) }, { eventStore } as never)
        .subscribe({ error: () => {} });
    };
    subs.push(
      eventStore.replaceable(10002, me).subscribe((ev) => {
        const read = ev ? uniqRelays(getInboxes(ev)) : [];
        const write = ev ? uniqRelays(getOutboxes(ev)) : [];
        readRelays$.next(read.length ? read : DEFAULT_RELAYS);
        writeRelays$.next(write.length ? write : DEFAULT_RELAYS);
        // no relay list (yet): listen on the defaults so edits made elsewhere still arrive
        const relays = healthy(uniqRelays(write, read));
        listen(relays.length ? relays : DEFAULT_RELAYS);
      }),
    );

    // connect remote signers and extensions in the background so actions feel instant
    const acct = accounts.find((a) => a.pubkey === me);
    if (acct && acct.type !== "key") getSigner(me).catch(() => {});

    return () => {
      cancelled = true;
      markLive(me, false);
      resolveSync();
      subs.forEach((s) => s.unsubscribe());
      live?.unsubscribe();
    };
  }, [me]); // eslint-disable-line react-hooks/exhaustive-deps
}
