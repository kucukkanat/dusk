import { ActionRunner } from "applesauce-actions";
import type { ActionBuilder } from "applesauce-actions";
import type { EventSigner } from "applesauce-core";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { getSigner, getActivePubkey } from "../state/accounts";
import { eventStore, quick, uniqRelays, writeRelays$, LOOKUP_RELAYS, DEFAULT_RELAYS } from "./core";
import { rebroadcast } from "./publish";

/** Pubkeys whose own lists the session has loaded and keeps live (see useSession). */
const live = new Set<string>();
export const markLive = (pubkey: string, on: boolean) => (on ? live.add(pubkey) : live.delete(pubkey));
const isLive = (pubkey: string) => live.has(pubkey);

/** The session's first fetch of a person's own lists, while it's in flight. */
const syncing = new Map<string, Promise<void>>();
/** Called by the session when it starts fetching a person's own lists; resolves when it settles. */
export function markSyncing(pubkey: string, done: Promise<void>) {
  syncing.set(pubkey, done);
  done.finally(() => syncing.get(pubkey) === done && syncing.delete(pubkey));
}
/** Resolves once the session's first fetch for this person has settled (at once if none is running). */
export const sessionSynced = (pubkey: string): Promise<void> => syncing.get(pubkey) ?? Promise.resolve();

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

/** A signer pinned to one account, so an action started before a switch still signs as its owner. */
function signerFor(pubkey: string): EventSigner {
  return { ...activeSigner, getPublicKey: async () => pubkey, signEvent: async (t) => (await getSigner(pubkey)).signEvent(t as never) };
}

// ActionRunner caches its user forever; one per account keeps edits from mixing lists between accounts
const runners = new Map<string, ActionRunner>();
function runnerFor(pubkey: string) {
  let r = runners.get(pubkey);
  if (!r)
    runners.set(
      pubkey,
      (r = new ActionRunner(eventStore, signerFor(pubkey), async (event: NostrEvent, relays?: string[]) => {
        const silent = event.kind === 1059;
        const sent = rebroadcast(event, relays?.length ? { only: uniqRelays(relays, silent ? [] : writeRelays$.value), silent } : { silent });
        // the runner already put it in the store; relays catch up in the background and failures show in the sync pill
        if (silent) await sent;
      })),
    );
  return r;
}

export function runAction<Args extends unknown[]>(builder: ActionBuilder<Args>, ...args: Args) {
  const me = getActivePubkey();
  if (!me) return Promise.reject(new Error("Sign in first"));
  return runnerFor(me).run(builder, ...args);
}

/**
 * Make sure we hold the newest version of one of the user's replaceable events before changing it.
 * Lists are rewritten whole, so editing a stale copy would wipe what other clients added.
 */
export async function ensureLatest(kind: number, pubkey = getActivePubkey(), identifier?: string): Promise<NostrEvent | undefined> {
  if (!pubkey) throw new Error("Sign in first");
  // the session is already fetching these; don't race it with a second request
  await sessionSynced(pubkey);
  const have = eventStore.getReplaceable(kind, pubkey, identifier);
  // the session has synced and is listening for changes made elsewhere, so a copy we hold is current
  if (have && isLive(pubkey)) return have;
  // a missing list may only be on a slower relay; writing a fresh one would wipe it, so take a short look
  const filter = identifier != null ? { kinds: [kind], authors: [pubkey], "#d": [identifier] } : { kinds: [kind], authors: [pubkey] };
  await quick(uniqRelays(writeRelays$.value, LOOKUP_RELAYS, DEFAULT_RELAYS), filter, { settle: have ? 400 : 800, cap: isLive(pubkey) ? 2000 : 4000 });
  return eventStore.getReplaceable(kind, pubkey, identifier);
}
