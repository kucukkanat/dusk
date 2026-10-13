import { useEffect, useMemo } from "react";
import { create } from "zustand";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { unlockGiftWrap } from "applesauce-common/helpers/gift-wrap";
import { GiftWrapFactory, WrappedMessageFactory } from "applesauce-common/factories";
import { getEventHash } from "nostr-tools/pure";
import { pool, readRelays$, uniqRelays, DEFAULT_RELAYS, now } from "./core";
import { activeSigner } from "./actions";
import { dmRelaysOf } from "./relays";
import { rebroadcast } from "./publish";
import { useActivePubkey, useActiveAccount, getActivePubkey } from "../state/accounts";
import { kvGet, kvSet, lsGet, lsSet } from "../lib/kv";

export type Rumor = { id: string; pubkey: string; created_at: number; kind: number; tags: string[][]; content: string };
export type DM = Rumor & { wrap: string; pending?: boolean; failed?: boolean };

type DMState = {
  owner: string | null;
  messages: Map<string, DM>;
  failed: Set<string>;
  queued: NostrEvent[];
  decrypting: boolean;
  /** For extension signers: user opted in to decrypting in the background */
  autoDecrypt: boolean;
  lastRead: Record<string, number>;
  hidden: string[];
  accepted: string[];
};

export const useDMs = create<DMState>()(() => ({
  owner: null,
  messages: new Map(),
  failed: new Set(),
  queued: [],
  decrypting: false,
  autoDecrypt: false,
  lastRead: {},
  hidden: [],
  accepted: [],
}));

function key(me: string) {
  return "dm:" + me;
}

async function persistMessages(me: string) {
  const s = useDMs.getState();
  if (s.owner !== me) return;
  await kvSet(key(me), { messages: [...s.messages.values()].filter((m) => !m.pending), failed: [...s.failed] });
}
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(me: string) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => persistMessages(me), 800);
}

function saveMeta(me: string) {
  const s = useDMs.getState();
  lsSet("dmmeta:" + me, { lastRead: s.lastRead, hidden: s.hidden, accepted: s.accepted, autoDecrypt: s.autoDecrypt });
}

function addRumor(me: string, rumor: Rumor, wrap: string) {
  if (rumor.kind !== 14 && rumor.kind !== 15 && rumor.kind !== 7) return;
  const s = useDMs.getState();
  if (s.owner !== me) return;
  const existing = s.messages.get(rumor.id);
  if (existing && !existing.pending) return;
  const messages = new Map(s.messages);
  messages.set(rumor.id, { ...rumor, wrap });
  useDMs.setState({ messages });
  schedulePersist(me);
}

async function drain(me: string) {
  const s = useDMs.getState();
  if (s.decrypting || s.owner !== me) return;
  useDMs.setState({ decrypting: true });
  try {
    while (useDMs.getState().queued.length && useDMs.getState().owner === me) {
      const [wrap, ...rest] = useDMs.getState().queued;
      useDMs.setState({ queued: rest });
      if (useDMs.getState().failed.has(wrap.id)) continue;
      try {
        const rumor = (await unlockGiftWrap(wrap, activeSigner as never)) as unknown as Rumor;
        addRumor(me, rumor, wrap.id);
      } catch (e) {
        if ((e as Error).message === "Locked") {
          useDMs.setState({ queued: [wrap, ...useDMs.getState().queued] });
          break;
        }
        const failed = new Set(useDMs.getState().failed);
        failed.add(wrap.id);
        useDMs.setState({ failed });
        schedulePersist(me);
      }
    }
  } finally {
    useDMs.setState({ decrypting: false });
  }
}

/** Fetch and decrypt NIP-17 messages for the signed-in person. */
export function useDMFeed() {
  const me = useActivePubkey();
  const account = useActiveAccount();
  const auto = useDMs((s) => s.autoDecrypt);
  const canAuto = !!account && (account.type !== "extension" || auto);

  useEffect(() => {
    if (!me) return;
    let alive = true;
    const meta = lsGet("dmmeta:" + me, { lastRead: {}, hidden: [] as string[], accepted: [] as string[], autoDecrypt: false });
    useDMs.setState({ owner: me, messages: new Map(), failed: new Set(), queued: [], ...meta });
    kvGet<{ messages: DM[]; failed: string[] }>(key(me)).then((saved) => {
      if (!alive || !saved) return;
      const messages = new Map(useDMs.getState().messages);
      for (const m of saved.messages) messages.set(m.id, m);
      useDMs.setState({ messages, failed: new Set([...saved.failed, ...useDMs.getState().failed]) });
    });
    const known = () => new Set([...useDMs.getState().messages.values()].map((m) => m.wrap));

    let subs: { unsubscribe(): void }[] = [];
    dmRelaysOf(me, 3000).then((dmRelays) => {
      if (!alive) return;
      const relays = uniqRelays(dmRelays, readRelays$.value.slice(0, 2));
      const onWrap = (e: NostrEvent) => {
        if (e.kind !== 1059) return;
        if (known().has(e.id) || useDMs.getState().failed.has(e.id)) return;
        if (useDMs.getState().queued.some((q) => q.id === e.id)) return;
        useDMs.setState({ queued: [...useDMs.getState().queued, e] });
      };
      // gift wraps are backdated up to two days, so look further back than the newest message
      subs = [
        pool.request(relays, { kinds: [1059], "#p": [me], limit: 1000 }, { timeout: 10000 } as never).subscribe({ next: onWrap, error: () => {} }),
        pool.subscription(relays, { kinds: [1059], "#p": [me], since: now() - 3 * 86400 }).subscribe({ next: onWrap, error: () => {} }),
      ];
    });
    return () => {
      alive = false;
      subs.forEach((s) => s.unsubscribe());
    };
  }, [me]);

  const queued = useDMs((s) => s.queued.length);
  useEffect(() => {
    if (me && canAuto && queued) drain(me);
  }, [me, canAuto, queued]);
}

export function decryptNow() {
  const me = getActivePubkey();
  if (me) drain(me);
}

export function setAutoDecrypt(on: boolean) {
  useDMs.setState({ autoDecrypt: on });
  const me = getActivePubkey();
  if (me) {
    saveMeta(me);
    if (on) drain(me);
  }
}

/* ---------- conversations ---------- */

export type Conversation = { id: string; with: string[]; messages: DM[]; last: DM; unread: number; isRequest: boolean };

export function participantsOf(m: Rumor) {
  return [...new Set([m.pubkey, ...m.tags.filter((t) => t[0] === "p").map((t) => t[1])])];
}

export function conversationId(me: string, parts: string[]) {
  const others = parts.filter((p) => p !== me);
  return (others.length ? others : [me]).sort().join(",");
}

export function useConversations(follows: Set<string>): Conversation[] {
  const me = useActivePubkey();
  const messages = useDMs((s) => s.messages);
  const lastRead = useDMs((s) => s.lastRead);
  const hidden = useDMs((s) => s.hidden);
  const accepted = useDMs((s) => s.accepted);
  return useMemo(() => {
    if (!me) return [];
    const map = new Map<string, DM[]>();
    for (const m of messages.values()) {
      if (m.kind === 7) continue;
      const id = conversationId(me, participantsOf(m));
      const arr = map.get(id) ?? [];
      arr.push(m);
      map.set(id, arr);
    }
    const out: Conversation[] = [];
    for (const [id, msgs] of map) {
      if (hidden.includes(id)) continue;
      msgs.sort((a, b) => a.created_at - b.created_at);
      const last = msgs[msgs.length - 1];
      const others = id.split(",");
      const iSent = msgs.some((m) => m.pubkey === me);
      const isRequest = !iSent && !accepted.includes(id) && !others.some((o) => follows.has(o));
      const unread = msgs.filter((m) => m.pubkey !== me && m.created_at > (lastRead[id] ?? 0)).length;
      out.push({ id, with: others, messages: msgs, last, unread, isRequest });
    }
    return out.sort((a, b) => b.last.created_at - a.last.created_at);
  }, [me, messages, lastRead, hidden, accepted, follows]);
}

export function markConversationRead(id: string, t = now()) {
  const me = getActivePubkey();
  if (!me) return;
  useDMs.setState((s) => ({ lastRead: { ...s.lastRead, [id]: t } }));
  saveMeta(me);
}
export function markConversationUnread(id: string) {
  const me = getActivePubkey();
  if (!me) return;
  useDMs.setState((s) => ({ lastRead: { ...s.lastRead, [id]: 0 } }));
  saveMeta(me);
}
export function hideConversation(id: string, on = true) {
  const me = getActivePubkey();
  if (!me) return;
  useDMs.setState((s) => ({ hidden: on ? [...s.hidden, id] : s.hidden.filter((x) => x !== id) }));
  saveMeta(me);
}
export function acceptConversation(id: string) {
  const me = getActivePubkey();
  if (!me) return;
  useDMs.setState((s) => ({ accepted: [...s.accepted, id] }));
  saveMeta(me);
}

/* ---------- sending ---------- */

/** Send a NIP-17 message: one gift wrap per participant, each to that person's DM relays. */
export async function sendDM(to: string[], content: string, opts: { kind?: 7 | 14 | 15; tags?: string[][]; replyTo?: string } = {}) {
  const me = getActivePubkey();
  if (!me) throw new Error("Sign in first");
  let template: { kind: number; content: string; tags: string[][]; created_at: number };
  if ((opts.kind ?? 14) === 14 && !opts.tags) {
    const t = await WrappedMessageFactory.create(to, content);
    template = { ...t, created_at: now() } as never;
    if (opts.replyTo) template.tags.push(["e", opts.replyTo, "", "reply"]);
  } else {
    template = { kind: opts.kind ?? 14, content, tags: [...to.map((p) => ["p", p]), ...(opts.tags ?? [])], created_at: now() };
  }
  const rumor: Rumor = { ...template, pubkey: me, id: "" };
  rumor.id = getEventHash(rumor as never);

  // show it right away
  const s = useDMs.getState();
  const messages = new Map(s.messages);
  messages.set(rumor.id, { ...rumor, wrap: "", pending: true });
  useDMs.setState({ messages });

  const participants = [...new Set([...to, me])];
  let delivered = 0;
  await Promise.all(
    participants.map(async (pk) => {
      const wrap = await GiftWrapFactory.create(activeSigner, pk, rumor as never);
      const relays = await dmRelaysOf(pk, 2500);
      try {
        await rebroadcast(wrap as NostrEvent, { only: relays.length ? relays : DEFAULT_RELAYS, silent: true });
        if (pk !== me) delivered++;
        if (pk === me) addRumor(me, rumor, wrap.id);
      } catch {
        /* reported below */
      }
    }),
  );
  const after = new Map(useDMs.getState().messages);
  const cur = after.get(rumor.id);
  if (cur) {
    after.set(rumor.id, { ...cur, pending: false, failed: delivered === 0 });
    useDMs.setState({ messages: after });
    schedulePersist(me);
  }
  if (delivered === 0) throw new Error("Couldn't deliver the message");
  return rumor;
}

/** Reactions sent inside the conversation (kind 7 rumors), keyed by message id. */
export function useDMReactions() {
  const messages = useDMs((s) => s.messages);
  return useMemo(() => {
    const out = new Map<string, DM[]>();
    for (const m of messages.values()) {
      if (m.kind !== 7) continue;
      const target = m.tags.find((t) => t[0] === "e")?.[1];
      if (!target) continue;
      out.set(target, [...(out.get(target) ?? []), m]);
    }
    return out;
  }, [messages]);
}
