import { useEffect, useState } from "react";
import { use$ } from "applesauce-react/hooks";
import { getProfileContent, type ProfileContent } from "applesauce-core/helpers/profile";
import { npubEncode } from "nostr-tools/nip19";
import { queryProfile } from "nostr-tools/nip05";
import { eventStore } from "./core";

export type { ProfileContent };

export function useProfile(pubkey?: string | null): ProfileContent | undefined {
  return use$(() => (pubkey ? eventStore.profile(pubkey) : undefined), [pubkey]);
}

export function shortNpub(pubkey: string) {
  try {
    const n = npubEncode(pubkey);
    return n.slice(0, 10) + "…" + n.slice(-4);
  } catch {
    return pubkey.slice(0, 8);
  }
}

export function nameOf(p: ProfileContent | undefined, pubkey: string) {
  const n = (p?.display_name || p?.displayName || p?.name || p?.username || "").trim();
  return n || shortNpub(pubkey);
}

/** Display name from whatever is already loaded (no subscription). */
export function displayName(pubkey: string) {
  const ev = eventStore.getReplaceable(0, pubkey);
  return nameOf(ev ? getProfileContent(ev) : undefined, pubkey);
}

export function pictureOf(p: ProfileContent | undefined) {
  const u = p?.picture || p?.image;
  return u && /^https?:\/\//.test(u) ? u : undefined;
}

/** Tones give people without a photo a stable, calm color. */
const TONES = ["mist", "peach", "rose", "sage", "lilac", "butter"] as const;
export function toneOf(pubkey: string) {
  let h = 0;
  for (let i = 0; i < 8; i++) h = (h * 31 + pubkey.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

/* ---------- NIP-05 verification ---------- */

const nip05Cache = new Map<string, Promise<boolean>>();

export function verifyNip05(address: string, pubkey: string): Promise<boolean> {
  const key = address.toLowerCase() + "|" + pubkey;
  let p = nip05Cache.get(key);
  if (!p) {
    p = queryProfile(address)
      .then((r) => r?.pubkey === pubkey)
      .catch(() => false);
    nip05Cache.set(key, p);
  }
  return p;
}

/** "valid" | "invalid" | "pending" | undefined (no address) */
export function useNip05(pubkey: string, address?: string) {
  const [state, setState] = useState<"valid" | "invalid" | "pending" | undefined>(address ? "pending" : undefined);
  useEffect(() => {
    if (!address) return setState(undefined);
    let live = true;
    setState("pending");
    verifyNip05(address, pubkey).then((ok) => live && setState(ok ? "valid" : "invalid"));
    return () => {
      live = false;
    };
  }, [address, pubkey]);
  return state;
}

export function formatNip05(a?: string) {
  if (!a) return "";
  return a.startsWith("_@") ? a.slice(2) : a;
}
