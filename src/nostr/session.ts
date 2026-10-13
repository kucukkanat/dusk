import { useEffect } from "react";
import { getInboxes, getOutboxes } from "applesauce-core/helpers/mailboxes";
import { DEFAULT_RELAYS, LOOKUP_RELAYS, eventStore, pool, readRelays$, writeRelays$, uniqRelays, warmFromCache } from "./core";
import { useActivePubkey, getSigner, useAccounts } from "../state/accounts";
import { markLive } from "./actions";

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

    warmFromCache([{ kinds: SELF_KINDS, authors: [me] }]).then(() => {
      if (cancelled) return;
      // initial fetch from the indexers and big relays
      subs.push(
        pool
          .request(uniqRelays(LOOKUP_RELAYS, DEFAULT_RELAYS), { kinds: SELF_KINDS, authors: [me] }, { eventStore, timeout: 8000 } as never)
          .subscribe({
            next: (e) => eventStore.add(e),
            error: () => {},
            // from here the live subscription below keeps these current, so edits can skip refetching
            complete: () => {
              synced = true;
              if (live && !cancelled) markLive(me, true);
            },
          }),
      );
    });

    // follow the relay list: point reads and writes at it, and keep listening there for changes made elsewhere
    let live: { unsubscribe(): void } | null = null;
    let synced = false;
    subs.push(
      eventStore.replaceable(10002, me).subscribe((ev) => {
        if (!ev) return;
        const read = uniqRelays(getInboxes(ev));
        const write = uniqRelays(getOutboxes(ev));
        readRelays$.next(read.length ? read : DEFAULT_RELAYS);
        writeRelays$.next(write.length ? write : DEFAULT_RELAYS);
        live?.unsubscribe();
        live = pool
          .subscription(uniqRelays(write, read), { kinds: SELF_KINDS, authors: [me], since: Math.floor(Date.now() / 1000) })
          .subscribe({ next: (e) => eventStore.add(e), error: () => {} });
        if (synced) markLive(me, true);
      }),
    );

    // connect remote signers and extensions in the background so actions feel instant
    const acct = accounts.find((a) => a.pubkey === me);
    if (acct && acct.type !== "key") getSigner(me).catch(() => {});

    return () => {
      cancelled = true;
      markLive(me, false);
      subs.forEach((s) => s.unsubscribe());
      live?.unsubscribe();
    };
  }, [me]); // eslint-disable-line react-hooks/exhaustive-deps
}
