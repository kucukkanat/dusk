import { useEffect, useMemo } from "react";
import { create } from "zustand";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { unlockGiftWrap } from "applesauce-common/helpers/gift-wrap";
import { GiftWrapFactory, WrappedMessageFactory } from "applesauce-common/factories";
import { getEventHash } from "nostr-tools/pure";
import { pool, eventStore, quick$, readRelays$, uniqRelays, DEFAULT_RELAYS, now } from "./core";
import { activeSigner } from "./actions";
import { dmRelaysOf } from "./relays";
import { rebroadcast } from "./publish";
import { useActivePubkey, useActiveAccount, getActivePubkey, useAccounts } from "../state/accounts";
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

/** NIP-59 backdates gift wraps by up to two days */
const BACKDATE = 2 * 86400;

/** Wrap ids we've decrypted, failed or queued for the current owner (so incoming copies are a Set lookup) */
let seen = new Set<string>();
/** Newest wrap created_at we've processed for the current owner */
let newest = 0;

async function persistMessages(me: string) {
  const s = useDMs.getState();
  if (s.owner !== me) return;
  await kvSet(key(me), { messages: [...s.messages.values()].filter((m) => !m.pending), failed: [...s.failed] });
  // only move `since` past what's actually saved, and never past a wrap still waiting to be decrypted
  let since = newest;
  for (const q of useDMs.getState().queued) since = Math.min(since, q.created_at);
  if (since && useDMs.getState().owner === me) lsSet("dmsince:" + me, since);
}
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(me: string) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => persistMessages(me), 1500);
}

function saveMeta(me: string) {
  const s = useDMs.getState();
  lsSet("dmmeta:" + me, { lastRead: s.lastRead, hidden: s.hidden, accepted: s.accepted, autoDecrypt: s.autoDecrypt });
}

/** Apply a batch of decrypted rumors (and failed wrap ids) in one state update. */
function applyBatch(me: string, rumors: { rumor: Rumor; wrap: string }[], failedIds: string[] = []) {
  const s = useDMs.getState();
  if (s.owner !== me) return;
  let messages: Map<string, DM> | null = null;
  for (const { rumor, wrap } of rumors) {
    seen.add(wrap);
    if (rumor.kind !== 14 && rumor.kind !== 15 && rumor.kind !== 7) continue;
    const existing = (messages ?? s.messages).get(rumor.id);
    if (existing && !existing.pending) continue;
    messages ??= new Map(s.messages);
    messages.set(rumor.id, { ...rumor, wrap });
  }
  let failed: Set<string> | null = null;
  for (const id of failedIds) {
    seen.add(id);
    (failed ??= new Set(s.failed)).add(id);
  }
  if (!messages && !failed) return;
  useDMs.setState({ ...(messages && { messages }), ...(failed && { failed }) });
  schedulePersist(me);
}

function addRumor(me: string, rumor: Rumor, wrap: string) {
  applyBatch(me, [{ rumor, wrap }]);
}

/* ---------- decrypting ---------- */

const BATCH = 15;
const yieldToBrowser = (): Promise<void> => {
  const y = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler?.yield;
  return y ? y.call((globalThis as { scheduler?: unknown }).scheduler) : new Promise((r) => setTimeout(r, 0));
};
/** Resolves once the browser is idle after first paint (decrypting is CPU-heavy) */
let painted: Promise<void> | null = null;
const afterPaint = () =>
  (painted ??= new Promise<void>((r) => {
    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(() => r(), { timeout: 2000 });
    else setTimeout(r, 1000);
  }));

async function drain(me: string) {
  const s = useDMs.getState();
  if (s.decrypting || s.owner !== me) return;
  useDMs.setState({ decrypting: true });
  try {
    await afterPaint();
    // remote signers answer over the network: keep a few requests in flight. Extensions prompt, so one at a time.
    const type = useAccounts.getState().accounts.find((a) => a.pubkey === me)?.type;
    const lanes = type === "bunker" ? 3 : 1;
    while (useDMs.getState().queued.length && useDMs.getState().owner === me) {
      const queued = useDMs.getState().queued;
      const batch = queued.slice(0, BATCH);
      useDMs.setState({ queued: queued.slice(BATCH) });
      const rumors: { rumor: Rumor; wrap: string }[] = [];
      const failedIds: string[] = [];
      const back: NostrEvent[] = [];
      let locked = false;
      let i = 0;
      const lane = async () => {
        while (i < batch.length) {
          const wrap = batch[i++];
          if (locked) {
            back.push(wrap);
            continue;
          }
          if (useDMs.getState().failed.has(wrap.id)) continue;
          try {
            rumors.push({ rumor: (await unlockGiftWrap(wrap, activeSigner as never)) as unknown as Rumor, wrap: wrap.id });
          } catch (e) {
            if ((e as Error).message === "Locked") {
              locked = true;
              back.push(wrap);
            } else failedIds.push(wrap.id);
          }
          if (!back.includes(wrap)) newest = Math.max(newest, wrap.created_at);
        }
      };
      await Promise.all(Array.from({ length: lanes }, lane));
      applyBatch(me, rumors, failedIds);
      if (locked) {
        useDMs.setState({ queued: [...back, ...useDMs.getState().queued] });
        break;
      }
      await yieldToBrowser();
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
    seen = new Set();
    newest = 0;
    useDMs.setState({ owner: me, messages: new Map(), failed: new Set(), queued: [], ...meta });

    // incoming wraps are buffered and queued in one update
    let buffer: NostrEvent[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      flushTimer = null;
      if (!alive || !buffer.length) return;
      const add = buffer;
      buffer = [];
      useDMs.setState({ queued: [...useDMs.getState().queued, ...add] });
    };
    let loaded = false;
    const onWrap = (e: NostrEvent) => {
      if (e.kind !== 1059 || seen.has(e.id)) return;
      seen.add(e.id);
      buffer.push(e);
      if (loaded) flushTimer ??= setTimeout(flush, 100);
    };

    kvGet<{ messages: DM[]; failed: string[] }>(key(me)).then((saved) => {
      if (!alive) return;
      if (saved) {
        const messages = new Map(useDMs.getState().messages);
        for (const m of saved.messages) {
          messages.set(m.id, m);
          if (m.wrap) seen.add(m.wrap);
        }
        for (const id of saved.failed) seen.add(id);
        // wraps that arrived before the saved state loaded may already be decrypted
        const done = new Set([...saved.messages.map((m) => m.wrap), ...saved.failed]);
        buffer = buffer.filter((e) => !done.has(e.id));
        useDMs.setState({ messages, failed: new Set([...saved.failed, ...useDMs.getState().failed]) });
      }
      loaded = true;
      flush();
    });

    const stored = lsGet<number>("dmsince:" + me, 0);
    newest = stored;
    const history = stored ? { since: stored - BACKDATE } : { limit: 1000 };
    const subs: { unsubscribe(): void }[] = [];
    const open = (relays: string[]) => {
      if (!alive || !relays.length) return;
      subs.push(
        quick$(relays, { kinds: [1059], "#p": [me], ...history }, { settle: 1500, cap: 10000 }).subscribe({ next: onWrap, error: () => {} }),
        // relays match `since` against the backdated created_at, so live must look back two days too
        pool.subscription(relays, { kinds: [1059], "#p": [me], since: now() - BACKDATE }).subscribe({ next: onWrap, error: () => {} }),
      );
    };
    // start on what we know now; add the DM relays (kind 10050) when they arrive
    const cached = eventStore.getReplaceable(10050, me);
    const first = uniqRelays(cached?.tags.filter((t) => t[0] === "relay").map((t) => t[1]), readRelays$.value.slice(0, 2));
    open(first.length ? first : DEFAULT_RELAYS);
    const have = new Set(first.length ? first : uniqRelays(DEFAULT_RELAYS));
    dmRelaysOf(me, 3000).then((dmRelays) => {
      const fresh = uniqRelays(dmRelays).filter((r) => !have.has(r));
      fresh.forEach((r) => have.add(r));
      open(fresh);
    });
    return () => {
      alive = false;
      if (flushTimer) clearTimeout(flushTimer);
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

/** Conversations without the follow check; `known` = I replied or accepted it */
type BaseConv = Omit<Conversation, "isRequest"> & { known: boolean };

// one shared result per messages/read-state change, however many components ask
let baseKey: unknown[] = [];
let baseVal: BaseConv[] = [];
let byFollows = new WeakMap<Set<string>, Conversation[]>();

function baseConversations(me: string, s: DMState): BaseConv[] {
  const k = [me, s.messages, s.lastRead, s.hidden, s.accepted];
  if (k.every((v, i) => v === baseKey[i])) return baseVal;
  const map = new Map<string, DM[]>();
  for (const m of s.messages.values()) {
    if (m.kind === 7) continue;
    const id = conversationId(me, participantsOf(m));
    const arr = map.get(id);
    if (arr) arr.push(m);
    else map.set(id, [m]);
  }
  const hidden = new Set(s.hidden);
  const accepted = new Set(s.accepted);
  const out: BaseConv[] = [];
  for (const [id, msgs] of map) {
    if (hidden.has(id)) continue;
    msgs.sort((a, b) => a.created_at - b.created_at);
    const read = s.lastRead[id] ?? 0;
    let unread = 0;
    let iSent = false;
    for (const m of msgs) {
      if (m.pubkey === me) iSent = true;
      else if (m.created_at > read) unread++;
    }
    out.push({ id, with: id.split(","), messages: msgs, last: msgs[msgs.length - 1], unread, known: iSent || accepted.has(id) });
  }
  baseKey = k;
  baseVal = out.sort((a, b) => b.last.created_at - a.last.created_at);
  byFollows = new WeakMap();
  return baseVal;
}

/** All conversations, newest first. Shared across callers; only the follow check is per follow set. */
export function conversationsOf(me: string, follows: Set<string>, s: DMState = useDMs.getState()): Conversation[] {
  const base = baseConversations(me, s);
  let out = byFollows.get(follows);
  if (!out) {
    out = base.map(({ known, ...c }) => ({ ...c, isRequest: !known && !c.with.some((o) => follows.has(o)) }));
    byFollows.set(follows, out);
  }
  return out;
}

export function useConversations(follows: Set<string>): Conversation[] {
  const me = useActivePubkey();
  const messages = useDMs((s) => s.messages);
  const lastRead = useDMs((s) => s.lastRead);
  const hidden = useDMs((s) => s.hidden);
  const accepted = useDMs((s) => s.accepted);
  return useMemo(
    () => (me ? conversationsOf(me, follows, { ...useDMs.getState(), messages, lastRead, hidden, accepted }) : []),
    [me, messages, lastRead, hidden, accepted, follows],
  );
}

/** Unread messages outside requests. */
export function useUnreadDMCount(follows: Set<string>): number {
  const convs = useConversations(follows);
  return useMemo(() => convs.reduce((n, c) => n + (c.isRequest ? 0 : c.unread), 0), [convs]);
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

/** Deliveries run one after another so messages arrive in the order they were written. */
let sendChain: Promise<unknown> = Promise.resolve();

/**
 * Send a NIP-17 message: one gift wrap per participant, each to that person's DM relays.
 * The message shows as pending at once; the returned promise settles when delivery does.
 */
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
  const deliver = async () => {
    let delivered = 0;
    await Promise.all(
      participants.map(async (pk) => {
        try {
          const [wrap, relays] = await Promise.all([GiftWrapFactory.create(activeSigner, pk, rumor as never), dmRelaysOf(pk, 2500)]);
          await rebroadcast(wrap as NostrEvent, { only: relays.length ? relays : DEFAULT_RELAYS, silent: true });
          if (pk !== me) delivered++;
          else addRumor(me, rumor, wrap.id);
        } catch {
          /* reported below */
        }
      }),
    );
    return delivered;
  };
  const run = sendChain.then(deliver, deliver);
  sendChain = run.catch(() => {});
  const delivered = await run;
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
