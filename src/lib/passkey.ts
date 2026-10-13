import { sha256 } from "@noble/hashes/sha2.js";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";

/**
 * Passkey identities. The Nostr key is stored inside the passkey (as its user handle), so the
 * password manager that holds the passkey (iCloud Keychain, Google Password Manager, 1Password…)
 * keeps and syncs it, and any device with that passkey can sign in. Only a discoverable passkey is
 * needed, which every passkey provider supports. Nothing is stored on a server.
 *
 * Passkeys made by an earlier build derived the key from the PRF extension instead; sign-in still
 * reads those.
 */

/** "d1" + 32-byte key */
const MAGIC = [0x64, 0x01];

const b64u = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export function passkeySupported() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;
}

function friendly(e: unknown): Error {
  const name = (e as Error)?.name;
  if (name === "NotAllowedError") return new Error("The passkey request was cancelled or timed out. Try again, or use 12 words instead.");
  if (name === "InvalidStateError") return new Error("This device already has that passkey.");
  if (name === "NotSupportedError" || name === "SecurityError") return new Error("Passkeys aren't available here. Use 12 words instead, or open Dusk in your phone's main browser.");
  return e instanceof Error ? e : new Error(String(e));
}

/** Create a passkey that holds a brand-new Nostr key. Call from a tap. */
export async function createPasskey(name: string): Promise<{ credId: string; sk: Uint8Array }> {
  const sk = generateSecretKey();
  const label = name || "Dusk identity";
  let cred: PublicKeyCredential;
  try {
    cred = (await navigator.credentials.create({
      publicKey: {
        rp: { name: "Dusk", id: location.hostname },
        user: { id: new Uint8Array([...MAGIC, ...sk]), name: label, displayName: label },
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
      },
    })) as PublicKeyCredential;
  } catch (e) {
    throw friendly(e);
  }
  return { credId: b64u(cred.rawId), sk };
}

// legacy: key derived from PRF output
const enc = new TextEncoder();
const SALT = sha256(enc.encode("dusk/nostr-key/v1"));
function deriveKey(prf: ArrayBuffer): Uint8Array {
  let sk = sha256(new Uint8Array([...enc.encode("dusk/nostr/v1"), ...new Uint8Array(prf)]));
  for (;;) {
    try {
      getPublicKey(sk);
      return sk;
    } catch {
      sk = sha256(sk);
    }
  }
}

/** Let the person pick their Dusk passkey and read the Nostr key from it. Call from a tap. */
export async function unlockPasskey(): Promise<{ credId: string; sk: Uint8Array }> {
  let cred: PublicKeyCredential;
  try {
    cred = (await navigator.credentials.get({
      publicKey: {
        rpId: location.hostname,
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        userVerification: "required",
        allowCredentials: [],
        extensions: { prf: { eval: { first: SALT } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential;
  } catch (e) {
    throw friendly(e);
  }
  const credId = b64u(cred.rawId);
  const handle = (cred.response as AuthenticatorAssertionResponse).userHandle;
  const h = handle ? new Uint8Array(handle) : null;
  if (h && h.length === 34 && h[0] === MAGIC[0] && h[1] === MAGIC[1]) return { credId, sk: h.slice(2) };
  const prf = (cred.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } }).prf?.results?.first;
  if (prf) return { credId, sk: deriveKey(prf) };
  throw new Error("That passkey doesn't hold a Dusk identity. Pick the one you made in Dusk.");
}
