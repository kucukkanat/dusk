import { ExtensionSigner, NostrConnectSigner, PrivateKeySigner } from "applesauce-signers";
import { getPublicKey } from "nostr-tools/pure";
import { decode } from "nostr-tools/nip19";
import { decrypt as nip49decrypt } from "nostr-tools/nip49";
import { privateKeyFromSeedWords, validateWords } from "nostr-tools/nip06";
import { hexToBytes } from "@noble/hashes/utils.js";
import { useAccounts, setSigner } from "./accounts";
import { useSettings } from "./settings";
import { publish } from "../nostr/publish";
import { DEFAULT_RELAYS, now } from "../nostr/core";

const PERMISSIONS = NostrConnectSigner.buildSigningPermissions([0, 1, 3, 5, 6, 7, 16, 1018, 1068, 1111, 1984, 9734, 10000, 10002, 10003, 10050, 10063, 13, 14, 15, 24242, 30000, 31925, 62, 22242]).concat(["nip44_encrypt", "nip44_decrypt", "nip04_encrypt", "nip04_decrypt"]);

function finish(pubkey: string) {
  useSettings.getState().set({ onboarded: true });
  return pubkey;
}

export async function loginExtension() {
  const s = new ExtensionSigner();
  const pubkey = await s.getPublicKey();
  setSigner(pubkey, s);
  useAccounts.getState().add({ pubkey, type: "extension", added: now() });
  return finish(pubkey);
}

export async function loginBunker(uri: string) {
  const s = await NostrConnectSigner.fromBunkerURI(uri.trim(), { permissions: PERMISSIONS });
  const pubkey = await s.getPublicKey();
  setSigner(pubkey, s);
  useAccounts.getState().add({ pubkey, type: "bunker", nbunksec: s.getNbunksec(), added: now() });
  return finish(pubkey);
}

export const NOSTRCONNECT_RELAYS = ["wss://relay.nsec.app", "wss://relay.damus.io", "wss://nos.lol"];

/** Start a nostrconnect:// session; resolves when a signer app scans the code and approves. */
export function startNostrConnect(abort: AbortSignal) {
  const s = new NostrConnectSigner({ relays: NOSTRCONNECT_RELAYS });
  const uri = s.getNostrConnectURI({ name: "Dusk", url: location.origin + location.pathname, image: location.origin + location.pathname + "icons/icon-192.png", permissions: PERMISSIONS });
  const done = s.waitForSigner(abort).then(async () => {
    const pubkey = await s.getPublicKey();
    setSigner(pubkey, s);
    useAccounts.getState().add({ pubkey, type: "bunker", nbunksec: s.getNbunksec(), added: now() });
    return finish(pubkey);
  });
  return { uri, done, close: () => s.close().catch(() => {}) };
}

/** Accept nsec, hex, ncryptsec or 12/24 seed words. */
export function parseSecret(input: string, password?: string): Uint8Array {
  const v = input.trim();
  if (v.startsWith("ncryptsec1")) {
    if (!password) throw new Error("Enter the password for this encrypted key");
    return nip49decrypt(v, password);
  }
  if (v.startsWith("nsec1")) {
    const d = decode(v);
    if (d.type !== "nsec") throw new Error("Not a private key");
    return d.data;
  }
  if (/^[0-9a-f]{64}$/i.test(v)) return hexToBytes(v.toLowerCase());
  const words = v.toLowerCase().split(/\s+/).join(" ");
  if (words.split(" ").length >= 12 && validateWords(words)) return privateKeyFromSeedWords(words);
  throw new Error("That doesn't look like a private key, encrypted key or seed words");
}

/** Sign in with a key kept on this device. `password` is only needed to open an ncryptsec. */
export function loginKey(input: string, password?: string) {
  const sk = parseSecret(input, password);
  const pubkey = getPublicKey(sk);
  setSigner(pubkey, new PrivateKeySigner(sk));
  useAccounts.getState().add({ pubkey, type: "key", secret: Buffer_hex(sk), added: now() });
  return finish(pubkey);
}

/** Create a brand new identity from seed words, publish a profile, relay lists and first follows. */
export async function createAccount(opts: { words: string; name: string; about?: string; follows: string[] }) {
  const sk = privateKeyFromSeedWords(opts.words);
  const pubkey = loginKey(Buffer_hex(sk));
  const relayTags = DEFAULT_RELAYS.map((r) => ["r", r]);
  await Promise.allSettled([
    publish({ kind: 0, content: JSON.stringify({ name: opts.name, display_name: opts.name, about: opts.about ?? "" }) }),
    publish({ kind: 10002, tags: relayTags }),
    publish({ kind: 10050, tags: DEFAULT_RELAYS.map((r) => ["relay", r]) }),
    publish({ kind: 3, tags: [...new Set([...opts.follows, pubkey])].map((p) => ["p", p]) }),
  ]);
  return pubkey;
}

function Buffer_hex(b: Uint8Array) {
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function hasExtension() {
  return !!(window as { nostr?: unknown }).nostr;
}

