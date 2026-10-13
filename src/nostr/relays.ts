import { firstValueFrom, filter, timeout, catchError, of } from "rxjs";
import { getInboxes, getOutboxes } from "applesauce-core/helpers/mailboxes";
import { DEFAULT_RELAYS, eventStore, uniqRelays } from "./core";

/** Load a person's relay list (kind 10002) and resolve within a time budget. */
export async function loadMailboxes(pubkey: string, ms = 2500): Promise<{ inboxes: string[]; outboxes: string[] } | undefined> {
  const have = eventStore.getReplaceable(10002, pubkey);
  if (have) return { inboxes: getInboxes(have), outboxes: getOutboxes(have) };
  const ev = await firstValueFrom(
    eventStore.replaceable(10002, pubkey).pipe(
      filter((e) => !!e),
      timeout(ms),
      catchError(() => of(undefined)),
    ),
  );
  return ev ? { inboxes: getInboxes(ev), outboxes: getOutboxes(ev) } : undefined;
}

export async function outboxesOf(pubkey: string, ms?: number): Promise<string[]> {
  const m = await loadMailboxes(pubkey, ms);
  return m?.outboxes.length ? uniqRelays(m.outboxes).slice(0, 5) : DEFAULT_RELAYS;
}

export async function inboxesOf(pubkey: string, ms?: number): Promise<string[]> {
  const m = await loadMailboxes(pubkey, ms);
  return m?.inboxes.length ? uniqRelays(m.inboxes).slice(0, 5) : DEFAULT_RELAYS;
}

/** NIP-17 DM relays (kind 10050), falling back to inboxes. */
export async function dmRelaysOf(pubkey: string, ms = 2500): Promise<string[]> {
  let ev = eventStore.getReplaceable(10050, pubkey);
  if (!ev)
    ev = await firstValueFrom(
      eventStore.replaceable(10050, pubkey).pipe(
        filter((e) => !!e),
        timeout(ms),
        catchError(() => of(undefined)),
      ),
    );
  const relays = ev ? uniqRelays(ev.tags.filter((t) => t[0] === "relay").map((t) => t[1])) : [];
  return relays.length ? relays : inboxesOf(pubkey, ms);
}

/** Read the relay hint for a pubkey from what we have, without waiting. */
export function hintFor(pubkey: string): string | undefined {
  const ev = eventStore.getReplaceable(10002, pubkey);
  return ev ? getOutboxes(ev)[0] : undefined;
}
