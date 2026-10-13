import type { EventTemplate, NostrEvent } from "applesauce-core/helpers/event";
import { create } from "zustand";
import type { PublishResponse } from "applesauce-relay";
import { signEvent } from "../state/accounts";
import { eventStore, pool, uniqRelays, writeRelays$, now, healthy } from "./core";
import { inboxesOf } from "./relays";

type Outgoing = { id: string; kind: number; state: "sending" | "failed"; error?: string; event: NostrEvent; relays: string[] };

/** What the sync pill shows: notes on their way out and any that failed everywhere. */
export const useOutbox = create<{ items: Outgoing[] }>()(() => ({ items: [] }));

function setItem(o: Outgoing | null, id: string) {
  useOutbox.setState((s) => ({ items: o ? [...s.items.filter((x) => x.id !== id), o] : s.items.filter((x) => x.id !== id) }));
}

export type PublishOptions = {
  /** Extra relays to send to */
  relays?: string[];
  /** Send to the inboxes of every tagged person (replies, mentions, reactions, zaps) */
  notifyTagged?: boolean;
  /** Only send to these relays */
  only?: string[];
  /** Do not add to the local store (gift wraps) */
  silent?: boolean;
};

/** Lists name people without addressing them; tagging them is no reason to write to their inboxes. */
const LIST_KINDS = new Set([3, 10000, 10001, 10002, 10003, 10050, 10063, 30000, 30002, 30003]);
/** Reactions and reposts tag a whole thread; only the author of the target needs to hear about it. */
const TARGET_KINDS = new Set([6, 7, 16]);
const MAX_RELAYS = 8;

function notifyWho(event: NostrEvent): string[] {
  if (LIST_KINDS.has(event.kind)) return [];
  const ps = event.tags.filter((t) => t[0] === "p" && t[1]?.length === 64).map((t) => t[1]);
  if (TARGET_KINDS.has(event.kind)) {
    const id = event.tags.filter((t) => t[0] === "e").at(-1)?.[1];
    const author = id ? eventStore.getEvent(id)?.pubkey : undefined;
    const who = author && ps.includes(author) ? author : ps.at(-1);
    return who && who !== event.pubkey ? [who] : [];
  }
  return [...new Set(ps)].filter((p) => p !== event.pubkey).slice(0, 12);
}

async function sendEvent(event: NostrEvent, opts: PublishOptions = {}) {
  let relays: string[];
  if (opts.only) relays = healthy(uniqRelays(opts.only));
  else {
    const write = healthy(uniqRelays(writeRelays$.value));
    const tagged = opts.notifyTagged !== false ? notifyWho(event) : [];
    const inboxes = await Promise.all(tagged.map((p) => inboxesOf(p, 1500).then((r) => healthy(r).slice(0, 2))));
    // our own relays first, then one inbox per tagged person, then whatever fits
    const firsts = inboxes.map((r) => r[0]).filter(Boolean);
    relays = uniqRelays(write.slice(0, 4), opts.relays, firsts, ...inboxes, write).slice(0, MAX_RELAYS);
  }
  if (!opts.silent) setItem({ id: event.id, kind: event.kind, state: "sending", event, relays }, event.id);
  try {
    const res = await firstAccept(relays, event);
    if (!res.ok) {
      const msg = res.message ?? "No server accepted it";
      if (!opts.silent) setItem({ id: event.id, kind: event.kind, state: "failed", error: msg, event, relays }, event.id);
      throw new Error(msg);
    }
    if (!opts.silent) setItem(null, event.id);
    return { event, accepted: [res.from] };
  } catch (e) {
    if (!opts.silent) setItem({ id: event.id, kind: event.kind, state: "failed", error: (e as Error).message, event, relays }, event.id);
    throw e;
  }
}

/** Send to every relay, but settle as soon as one accepts; the rest keep going in the background. */
function firstAccept(relays: string[], event: NostrEvent): Promise<PublishResponse> {
  return new Promise((resolve) => {
    let left = relays.length;
    let failure: PublishResponse | undefined;
    if (!left) return resolve({ ok: false, from: "", message: "No servers to send to" });
    for (const url of relays)
      pool
        .relay(url)
        .publish(event, { timeout: 10000 } as never)
        .catch((e: Error): PublishResponse => ({ ok: false, from: url, message: e.message }))
        .then((r) => {
          if (r.ok) return resolve(r);
          failure ??= r.message ? r : undefined;
          if (--left === 0) resolve(failure ?? { ok: false, from: url });
        });
  });
}

/**
 * Sign a template with the active account and send it to the right relays (outbox model).
 * Resolves as soon as it is signed and on screen; sending carries on in the background and the
 * sync pill shows (and retries) anything no relay accepted. Await `sent` to wait for a relay.
 */
export async function publish(template: Partial<EventTemplate> & { kind: number }, opts: PublishOptions = {}) {
  const t: EventTemplate = { content: "", tags: [], created_at: now(), ...template };
  const event = await signEvent(t);
  if (opts.silent) return sendEvent(event, opts).then((r) => ({ ...r, sent: Promise.resolve(r) }));
  eventStore.add(event);
  return { event, sent: background(event, opts) };
}

/** Send an already-signed event (retry from the outbox, or gift wraps). Silent sends are awaited: nothing else reports them. */
export const rebroadcast = (event: NostrEvent, opts?: PublishOptions) => (opts?.silent ? sendEvent(event, opts) : background(event, opts));

function background(event: NostrEvent, opts?: PublishOptions) {
  const sent = sendEvent(event, opts);
  sent.catch(() => {}); // failures land in the sync pill
  return sent;
}

export function retryFailed() {
  for (const o of useOutbox.getState().items.filter((x) => x.state === "failed")) sendEvent(o.event, { only: o.relays }).catch(() => {});
}

export function dropFailed(id: string) {
  setItem(null, id);
}
