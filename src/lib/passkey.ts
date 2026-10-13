import { sha256 } from "@noble/hashes/sha2.js";
import { getPublicKey } from "nostr-tools/pure";

/**
 * Passkey identities: the Nostr key is derived from the passkey's PRF output (WebAuthn's
 * pseudo-random function extension), so the same passkey gives the same key on every device it
 * syncs to (iCloud Keychain, Google Password Manager, 1Password…). Nothing is stored on a server.
 */

const enc = new TextEncoder();
/** Fixed per-app input to the PRF; changing it would change every derived key. */
const SALT = sha256(enc.encode("dusk/nostr-key/v1"));

const b64u = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export function passkeySupported() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;
}

/** Turn PRF output into a valid secp256k1 private key. */
function deriveKey(prf: ArrayBuffer): Uint8Array {
  let sk = sha256(new Uint8Array([...enc.encode("dusk/nostr/v1"), ...new Uint8Array(prf)]));
  // out-of-range scalars are astronomically rare; rehash until valid
  for (;;) {
    try {
      getPublicKey(sk);
      return sk;
    } catch {
      sk = sha256(sk);
    }
  }
}

type PrfResults = { enabled?: boolean; results?: { first?: ArrayBuffer } };
const prfOf = (c: PublicKeyCredential) => (c.getClientExtensionResults() as { prf?: PrfResults }).prf;

const UNSUPPORTED = "This passkey can't hold a Nostr key. Use iCloud Keychain, Google Password Manager or another manager that supports passkey encryption (PRF), or keep your key as 12 words instead.";

function friendly(e: unknown): Error {
  const name = (e as Error)?.name;
  if (name === "NotAllowedError") return new Error("Passkey request was cancelled");
  if (name === "InvalidStateError") return new Error("A Dusk passkey already exists on this device");
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * Create a passkey for a new identity. Some browsers return the PRF output at creation; others
 * only on use, in which case `sk` is missing and the caller must call {@link unlockPasskey} from a tap.
 */
export async function createPasskey(name: string): Promise<{ credId: string; sk?: Uint8Array }> {
  let cred: PublicKeyCredential;
  try {
    cred = (await navigator.credentials.create({
      publicKey: {
        rp: { name: "Dusk", id: location.hostname },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: name || "Dusk identity", displayName: name || "Dusk identity" },
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        extensions: { prf: { eval: { first: SALT } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential;
  } catch (e) {
    throw friendly(e);
  }
  const prf = prfOf(cred);
  if (prf?.enabled === false) throw new Error(UNSUPPORTED);
  const credId = b64u(cred.rawId);
  return { credId, sk: prf?.results?.first ? deriveKey(prf.results.first) : undefined };
}

/** Use a passkey (a specific one, or let the person pick) and derive its Nostr key. Call from a tap. */
export async function unlockPasskey(credId?: string): Promise<{ credId: string; sk: Uint8Array }> {
  let cred: PublicKeyCredential;
  try {
    cred = (await navigator.credentials.get({
      publicKey: {
        rpId: location.hostname,
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        userVerification: "required",
        allowCredentials: credId ? [{ type: "public-key", id: unb64u(credId) }] : [],
        extensions: { prf: { eval: { first: SALT } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential;
  } catch (e) {
    throw friendly(e);
  }
  const first = prfOf(cred)?.results?.first;
  if (!first) throw new Error(UNSUPPORTED);
  return { credId: b64u(cred.rawId), sk: deriveKey(first) };
}
