import { ActionRunner } from "applesauce-actions";
import { RelayGroup } from "applesauce-relay";
import type { ActionBuilder } from "applesauce-actions";
import type { EventSigner } from "applesauce-core";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { getSigner, getActivePubkey } from "../state/accounts";
import { eventStore, pool, uniqRelays, writeRelays$, LOOKUP_RELAYS, DEFAULT_RELAYS } from "./core";
import { rebroadcast } from "./publish";

/** A signer that resolves the active account's signer on demand (unlock or reconnect when needed). */
export const activeSigner: EventSigner = {
  getPublicKey: async () => {
    const pk = getActivePubkey();
    if (!pk) throw new Error("Sign in first");
    return pk;
  },
  signEvent: async (t) => (await getSigner()).signEvent(t as never),
  nip04: {
    encrypt: async (pk, pt) => {
      const s = await getSigner();
      if (!s.nip04) throw new Error("Your signer can't encrypt (NIP-04)");
      return s.nip04.encrypt(pk, pt);
    },
    decrypt: async (pk, ct) => {
      const s = await getSigner();
      if (!s.nip04) throw new Error("Your signer can't decrypt (NIP-04)");
      return s.nip04.decrypt(pk, ct);
    },
  },
  nip44: {
    encrypt: async (pk, pt) => {
      const s = await getSigner();
      if (!s.nip44) throw new Error("Your signer can't encrypt (NIP-44)");
      return s.nip44.encrypt(pk, pt);
    },
    decrypt: async (pk, ct) => {
      const s = await getSigner();
      if (!s.nip44) throw new Error("Your signer can't decrypt (NIP-44)");
      return s.nip44.decrypt(pk, ct);
    },
  },
};

const runner = new ActionRunner(eventStore, activeSigner, async (event: NostrEvent, relays?: string[]) => {
  const silent = event.kind === 1059;
  await rebroadcast(event, relays?.length ? { only: uniqRelays(relays, silent ? [] : writeRelays$.value) } : { silent });
});

export function runAction<Args extends unknown[]>(builder: ActionBuilder<Args>, ...args: Args) {
  return runner.run(builder, ...args);
}

/**
 * Make sure we hold the newest version of one of the user's replaceable events before changing it.
 * Lists are rewritten whole, so editing a stale copy would wipe what other clients added.
 */
export async function ensureLatest(kind: number, pubkey = getActivePubkey(), identifier?: string): Promise<NostrEvent | undefined> {
  if (!pubkey) throw new Error("Sign in first");
  const relays = uniqRelays(writeRelays$.value, LOOKUP_RELAYS, DEFAULT_RELAYS);
  const have = eventStore.getReplaceable(kind, pubkey, identifier);
  const filter = identifier != null ? { kinds: [kind], authors: [pubkey], "#d": [identifier] } : { kinds: [kind], authors: [pubkey] };
  // the session keeps this live already; a short check is enough, and settle soon after the first relay answers
  await new Promise<void>((resolve) => {
    const complete = RelayGroup.completeOnAny(RelayGroup.completeAfterFirstRelay(have ? 400 : 1200), RelayGroup.completeOnAllEose());
    const sub = pool.request(relays, filter, { eventStore, timeout: 6000, complete } as never).subscribe({
      next: (e) => eventStore.add(e),
      complete: () => resolve(),
      error: () => resolve(),
    });
    setTimeout(() => {
      sub.unsubscribe();
      resolve();
    }, 6500);
  });
  return eventStore.getReplaceable(kind, pubkey, identifier);
}
