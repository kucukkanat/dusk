import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EventTemplate, NostrEvent } from "applesauce-core/helpers/event";
import { ExtensionSigner, NostrConnectSigner, PrivateKeySigner } from "applesauce-signers";
import type { ISigner } from "applesauce-signers";
import { decrypt as nip49decrypt, encrypt as nip49encrypt } from "nostr-tools/nip49";
import { requestUnlock } from "./ui";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

export type AccountType = "extension" | "bunker" | "key";
export type Account = {
  pubkey: string;
  type: AccountType;
  /** nbunksec for bunker sessions */
  nbunksec?: string;
  /** Hex private key kept on this device */
  secret?: string;
  /** Older accounts: NIP-49 encrypted key, converted to `secret` on first unlock */
  ncryptsec?: string;
  added: number;
};

type AccountsStore = {
  accounts: Account[];
  active: string | null;
  add: (a: Account) => void;
  remove: (pubkey: string) => void;
  setActive: (pubkey: string | null) => void;
};

export const useAccounts = create<AccountsStore>()(
  persist(
    (set) => ({
      accounts: [],
      active: null,
      add: (a) =>
        set((s) => ({ accounts: [...s.accounts.filter((x) => x.pubkey !== a.pubkey), a], active: a.pubkey })),
      remove: (pubkey) =>
        set((s) => {
          const accounts = s.accounts.filter((x) => x.pubkey !== pubkey);
          signers.delete(pubkey);
          return { accounts, active: s.active === pubkey ? (accounts[0]?.pubkey ?? null) : s.active };
        }),
      setActive: (pubkey) => set({ active: pubkey }),
    }),
    { name: "dusk.accounts", version: 1 },
  ),
);

export const getActivePubkey = () => useAccounts.getState().active;
export const useActivePubkey = () => useAccounts((s) => s.active);
export const useActiveAccount = () => useAccounts((s) => s.accounts.find((a) => a.pubkey === s.active) ?? null);

/* ---------- signers ---------- */

const signers = new Map<string, ISigner>();
const pending = new Map<string, Promise<ISigner>>();

async function waitForExtension(ms = 1500): Promise<boolean> {
  const start = Date.now();
  while (!(window as { nostr?: unknown }).nostr) {
    if (Date.now() - start > ms) return false;
    await new Promise((r) => setTimeout(r, 100));
  }
  return true;
}

async function buildSigner(a: Account): Promise<ISigner> {
  if (a.type === "extension") {
    if (!(await waitForExtension())) throw new Error("No Nostr browser extension found");
    const s = new ExtensionSigner();
    const pk = await s.getPublicKey();
    if (pk !== a.pubkey) throw new Error("Your extension is signed in with a different key");
    return s;
  }
  if (a.type === "bunker") {
    if (!a.nbunksec) throw new Error("Missing remote signer session");
    return NostrConnectSigner.fromNbunksec(a.nbunksec);
  }
  if (a.secret) return new PrivateKeySigner(hexToBytes(a.secret));
  if (!a.ncryptsec) throw new Error("Missing key");
  for (let tries = 0; tries < 3; tries++) {
    const pw = await requestUnlock(a.pubkey);
    if (pw == null) throw new Error("Locked");
    try {
      const sk = nip49decrypt(a.ncryptsec, pw);
      // one-time migration: keep the key without a password from now on
      useAccounts.setState((s) => ({ accounts: s.accounts.map((x) => (x.pubkey === a.pubkey ? { ...x, secret: bytesToHex(sk), ncryptsec: undefined } : x)) }));
      return new PrivateKeySigner(sk);
    } catch {
      /* wrong password; ask again */
    }
  }
  throw new Error("Wrong password");
}

/** Get (and lazily unlock or connect) the signer for an account. */
export async function getSigner(pubkey = getActivePubkey()): Promise<ISigner> {
  if (!pubkey) throw new Error("Sign in first");
  const ready = signers.get(pubkey);
  if (ready) return ready;
  const inflight = pending.get(pubkey);
  if (inflight) return inflight;
  const a = useAccounts.getState().accounts.find((x) => x.pubkey === pubkey);
  if (!a) throw new Error("Unknown account");
  const p = buildSigner(a)
    .then((s) => {
      signers.set(pubkey, s);
      return s;
    })
    .finally(() => pending.delete(pubkey));
  pending.set(pubkey, p);
  return p;
}

export const hasSignerReady = (pubkey = getActivePubkey()) => !!pubkey && signers.has(pubkey);

export function setSigner(pubkey: string, s: ISigner) {
  signers.set(pubkey, s);
}

export async function signEvent(template: EventTemplate): Promise<NostrEvent> {
  const s = await getSigner();
  return s.signEvent(template);
}

export async function lockAccount(pubkey: string) {
  const s = signers.get(pubkey);
  if (s instanceof NostrConnectSigner) await s.close().catch(() => {});
  signers.delete(pubkey);
}

/** Encrypt a key for export (NIP-49). */
export function encryptKey(sk: Uint8Array, password: string) {
  return nip49encrypt(sk, password, 16, 0x01);
}
