import { decode, naddrEncode, neventEncode, npubEncode, nprofileEncode } from "nostr-tools/nip19";
import type { NostrEvent } from "applesauce-core/helpers/event";
import type { AddressPointer, EventPointer, ProfilePointer } from "applesauce-core/helpers/pointers";
import { hintFor } from "../nostr/relays";

export const isAddressable = (kind: number) => kind >= 30000 && kind < 40000;

export function npub(pk: string) {
  try {
    return npubEncode(pk);
  } catch {
    return pk;
  }
}

export function profilePath(pk: string) {
  return "/p/" + npub(pk);
}

export function nprofile(pk: string) {
  const h = hintFor(pk);
  return nprofileEncode({ pubkey: pk, relays: h ? [h] : [] });
}

export function eventCode(e: NostrEvent) {
  const h = hintFor(e.pubkey);
  if (isAddressable(e.kind)) {
    const d = e.tags.find((t) => t[0] === "d")?.[1] ?? "";
    return naddrEncode({ kind: e.kind, pubkey: e.pubkey, identifier: d, relays: h ? [h] : [] });
  }
  return neventEncode({ id: e.id, author: e.pubkey, kind: e.kind, relays: h ? [h] : [] });
}

export function eventPath(e: NostrEvent) {
  return isAddressable(e.kind) ? "/a/" + eventCode(e) : "/e/" + eventCode(e);
}

export function shareUrl(path: string) {
  return location.origin + location.pathname + "#" + path;
}

export const tagPath = (t: string) => "/t/" + encodeURIComponent(t.replace(/^#/, "").toLowerCase());

export type Decoded =
  | { type: "profile"; pointer: ProfilePointer }
  | { type: "event"; pointer: EventPointer }
  | { type: "address"; pointer: AddressPointer }
  | { type: "invalid" };

/** Parse an npub/nprofile/note/nevent/naddr/hex string, with or without a nostr: prefix. */
export function decodeAny(raw: string): Decoded {
  let s = decodeURIComponent(raw).trim();
  s = s.replace(/^web\+nostr:/i, "").replace(/^nostr:/i, "").replace(/^\/+/, "");
  if (/^[0-9a-f]{64}$/i.test(s)) return { type: "event", pointer: { id: s.toLowerCase() } };
  try {
    const d = decode(s);
    switch (d.type) {
      case "npub":
        return { type: "profile", pointer: { pubkey: d.data } };
      case "nprofile":
        return { type: "profile", pointer: d.data };
      case "note":
        return { type: "event", pointer: { id: d.data } };
      case "nevent":
        return { type: "event", pointer: d.data };
      case "naddr":
        return { type: "address", pointer: d.data };
    }
  } catch {
    /* fall through */
  }
  return { type: "invalid" };
}

export function pathFor(raw: string): string | null {
  const d = decodeAny(raw);
  if (d.type === "profile") return profilePath(d.pointer.pubkey);
  if (d.type === "event") return "/e/" + neventEncode(d.pointer);
  if (d.type === "address") return "/a/" + naddrEncode(d.pointer);
  return null;
}

export function pubkeyFrom(raw: string): string | null {
  if (/^[0-9a-f]{64}$/i.test(raw)) return raw.toLowerCase();
  const d = decodeAny(raw);
  return d.type === "profile" ? d.pointer.pubkey : null;
}
