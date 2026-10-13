import { useSyncExternalStore } from "react";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { ReactionFactory } from "applesauce-common/factories";
import { getReplaceableAddressForEvent } from "applesauce-core/helpers/pointers";
import { publish } from "../nostr/publish";
import { eventStore } from "../nostr/core";
import { hintFor } from "../nostr/relays";
import { toast, errorToast } from "../state/ui";
import { getActivePubkey } from "../state/accounts";
import { openOnboarding } from "../screens/Onboarding";

export function requireSignIn(): boolean {
  if (getActivePubkey()) return true;
  openOnboarding("signin");
  return false;
}

export type Emoji = string | { shortcode: string; url: string };

/* ---------- pending reactions and reposts ---------- */

/** Likes and reposts waiting on the signer, keyed "<event id>:<kind>". publish() puts the result in the store once signed. */
const pending = new Set<string>();
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));

/** Whether a like (7) or repost (6) of this event is still being signed; lets buttons show it before the signer answers. */
export function usePendingAction(id: string, kind: 6 | 7) {
  return useSyncExternalStore(subscribe, () => pending.has(id + ":" + kind));
}

/** Run once per event and kind at a time, so a double tap doesn't sign twice. */
async function once(key: string, fn: () => Promise<void>) {
  if (pending.has(key)) return;
  pending.add(key);
  changed();
  try {
    await fn();
  } finally {
    pending.delete(key);
    changed();
  }
}

export async function react(event: NostrEvent, emoji: Emoji = "+") {
  if (!requireSignIn()) return;
  await once(event.id + ":7", async () => {
    try {
      const t = await ReactionFactory.create(event, typeof emoji === "string" ? emoji : { shortcode: emoji.shortcode, url: emoji.url } as never);
      await publish(t);
    } catch (e) {
      errorToast(e, "Couldn't react");
    }
  });
}

/** Retract one of our own events with a deletion request (NIP-09). */
export async function deleteEvents(events: NostrEvent[], reason = "") {
  if (!events.length) return;
  const tags: string[][] = [];
  for (const e of events) {
    tags.push(["e", e.id]);
    const a = getReplaceableAddressForEvent(e);
    if (a) tags.push(["a", a]);
    tags.push(["k", String(e.kind)]);
  }
  const res = await publish({ kind: 5, content: reason, tags });
  for (const e of events) eventStore.remove(e);
  return res;
}

export async function unreact(reaction: NostrEvent) {
  try {
    await deleteEvents([reaction]);
  } catch (e) {
    errorToast(e, "Couldn't remove reaction");
  }
}

export async function repost(event: NostrEvent) {
  if (!requireSignIn()) return;
  await once(event.id + ":6", async () => {
    try {
      const hint = hintFor(event.pubkey) ?? "";
      const generic = event.kind !== 1;
      const tags = [
        ["e", event.id, hint],
        ["p", event.pubkey],
      ];
      if (generic) tags.push(["k", String(event.kind)]);
      const a = getReplaceableAddressForEvent(event);
      if (a) tags.push(["a", a, hint]);
      await publish({ kind: generic ? 16 : 6, content: JSON.stringify(event), tags });
      toast("Reposted");
    } catch (e) {
      errorToast(e, "Couldn't repost");
    }
  });
}

export async function report(event: NostrEvent | null, pubkey: string, type: string, reason: string) {
  const tags = event ? [["e", event.id, type], ["p", pubkey]] : [["p", pubkey, type]];
  await publish({ kind: 1984, content: reason, tags }, { notifyTagged: false });
  toast("Report sent. Thank you.");
}
