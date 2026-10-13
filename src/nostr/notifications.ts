import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { use$ } from "applesauce-react/hooks";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { getContacts } from "applesauce-core/helpers/contacts";
import { getZapAmount, getZapSender, getZapRequest } from "applesauce-common/helpers/zap";
import { getNip10References } from "applesauce-common/helpers/threading";
import { eventStore, pool, readRelays$, uniqRelays, DEFAULT_RELAYS, now } from "./core";
import { useActivePubkey } from "../state/accounts";
import { useSettings, getSettings } from "../state/settings";
import { lsGet, lsSet } from "../lib/kv";
import { displayName } from "./profile";

export type NotifKind = "like" | "repost" | "zap" | "reply" | "mention" | "quote" | "follow";
export type Notif = {
  id: string;
  kind: NotifKind;
  who: string[];
  /** The note this is about (yours for likes/reposts/zaps; theirs for replies and mentions) */
  target?: string;
  event: NostrEvent;
  amount?: number;
  comment?: string;
  emoji?: string;
  t: number;
  unread: boolean;
};

const KINDS = [1, 6, 7, 16, 9735, 1111, 3];

type ReadState = { lastRead: number; unreadIds: string[]; readIds: string[]; followers: string[] };
export const useNotifRead = create<ReadState & { markAll: () => void; toggle: (id: string, unread: boolean) => void }>()((set, get) => ({
  ...lsGet<ReadState>("notifread", { lastRead: 0, unreadIds: [], readIds: [], followers: [] }),
  markAll: () => {
    set({ lastRead: now(), unreadIds: [], readIds: [] });
    persist(get());
  },
  toggle: (id, unread) => {
    const s = get();
    set({
      unreadIds: unread ? [...s.unreadIds, id] : s.unreadIds.filter((x) => x !== id),
      readIds: unread ? s.readIds.filter((x) => x !== id) : [...s.readIds, id].slice(-500),
    });
    persist(get());
  },
}));
function persist(s: ReadState) {
  lsSet("notifread", { lastRead: s.lastRead, unreadIds: s.unreadIds, readIds: s.readIds, followers: s.followers });
}

/** Listen for anything that mentions the signed-in person, on their inbox relays. */
export function useNotificationFeed() {
  const me = useActivePubkey();
  useEffect(() => {
    if (!me) return;
    const relays = uniqRelays(readRelays$.value, DEFAULT_RELAYS);
    const since = now() - 14 * 86400;
    const filter = { kinds: KINDS, "#p": [me], since };
    const req = pool.request(relays, { ...filter, limit: 300 }, { eventStore, timeout: 8000 } as never).subscribe({ next: (e) => eventStore.add(e), error: () => {} });
    const live = pool.subscription(relays, { kinds: KINDS, "#p": [me], since: now() }).subscribe({
      next: (e) => {
        const stored = eventStore.add(e) ?? e;
        maybeAlert(stored, me);
      },
      error: () => {},
    });
    return () => {
      req.unsubscribe();
      live.unsubscribe();
    };
  }, [me]);
}

function inQuietHours() {
  const h = new Date().getHours();
  return h >= 22 || h < 7;
}

function maybeAlert(e: NostrEvent, me: string) {
  if (e.pubkey === me || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;
  const s = getSettings();
  if (s.notif.quiet && inQuietHours()) return;
  const kind = classify(e, me);
  if (!kind) return;
  if ((kind === "reply" || kind === "mention" || kind === "quote") && !s.notif.mentions) return;
  if (kind === "zap" && !s.notif.zaps) return;
  if ((kind === "like" || kind === "repost") && !s.notif.likes) return;
  if (kind === "follow") return; // follow lists change often; don't buzz for them
  const who = kind === "zap" ? (getZapSender(e) ?? e.pubkey) : e.pubkey;
  const name = displayName(who);
  const text = { like: "liked your note", repost: "reposted your note", zap: "zapped you", reply: "replied to you", mention: "mentioned you", quote: "quoted your note", follow: "followed you" }[kind];
  try {
    navigator.serviceWorker?.ready.then((reg) => reg.showNotification("Dusk", { body: `${name} ${text}`, icon: "./icons/icon-192.png", tag: e.id }));
  } catch {
    /* ignore */
  }
}

function classify(e: NostrEvent, me: string): NotifKind | null {
  switch (e.kind) {
    case 7:
      return e.content === "-" ? null : "like";
    case 6:
    case 16:
      return "repost";
    case 9735:
      return "zap";
    case 3:
      return getContacts(e).some((p) => p.pubkey === me) ? "follow" : null;
    case 1111:
      return "reply";
    case 1: {
      if (e.tags.some((t) => t[0] === "q")) {
        const q = e.tags.find((t) => t[0] === "q")?.[1];
        const qe = q ? eventStore.getEvent(q) : undefined;
        if (qe?.pubkey === me) return "quote";
      }
      const refs = getNip10References(e);
      if (refs.reply || refs.root) {
        const parentId = refs.reply?.e?.id ?? refs.root?.e?.id;
        const parent = parentId ? eventStore.getEvent(parentId) : undefined;
        if (!parent || parent.pubkey === me) return "reply";
      }
      return "mention";
    }
  }
  return null;
}

function targetOf(e: NostrEvent, kind: NotifKind): string | undefined {
  if (kind === "like" || kind === "repost") return [...e.tags].reverse().find((t) => t[0] === "e")?.[1];
  if (kind === "zap") return e.tags.find((t) => t[0] === "e")?.[1];
  if (kind === "quote") return e.tags.find((t) => t[0] === "q")?.[1];
  return e.id;
}

export function useNotifications(): Notif[] {
  const me = useActivePubkey();
  const read = useNotifRead();
  const events = use$(() => (me ? eventStore.timeline({ kinds: KINDS, "#p": [me] }) : undefined), [me]);
  return useMemo(() => {
    if (!me || !events) return [];
    const groups = new Map<string, Notif>();
    const out: Notif[] = [];
    const knownFollowers = new Set(read.followers);
    for (const e of events) {
      if (e.pubkey === me && e.kind !== 9735) continue;
      const kind = classify(e, me);
      if (!kind) continue;
      if (kind === "follow" && knownFollowers.has(e.pubkey) && e.created_at < read.lastRead) continue;
      const who: string | undefined = kind === "zap" ? getZapSender(e) : e.pubkey;
      if (!who || who === me) continue;
      const target = targetOf(e, kind);
      const unread = read.unreadIds.includes(e.id) || (!read.readIds.includes(e.id) && e.created_at > read.lastRead);
      if (kind === "like" || kind === "repost") {
        const gk = kind + ":" + target;
        const g = groups.get(gk);
        if (g) {
          if (!g.who.includes(who)) g.who.push(who);
          g.unread = g.unread || unread;
          continue;
        }
        const n: Notif = { id: e.id, kind, who: [who], target, event: e, t: e.created_at, unread, emoji: kind === "like" && e.content !== "+" ? e.content : undefined };
        groups.set(gk, n);
        out.push(n);
        continue;
      }
      const n: Notif = { id: e.id, kind, who: [who], target, event: e, t: e.created_at, unread };
      if (kind === "zap") {
        n.amount = Math.round((getZapAmount(e) ?? 0) / 1000);
        n.comment = getZapRequest(e)?.content;
      }
      out.push(n);
    }
    return out.sort((a, b) => b.t - a.t);
  }, [events, me, read]);
}

export function useHasUnreadActivity() {
  const items = useNotifications();
  const notif = useSettings((s) => s.notif);
  return items.some((n) => n.unread && (notif.likes || (n.kind !== "like" && n.kind !== "repost")));
}

/** Remember who followed us so their next follow-list edit doesn't show up again. */
export function rememberFollowers(pubkeys: string[]) {
  const s = useNotifRead.getState();
  const known = new Set(s.followers);
  if (pubkeys.every((p) => known.has(p))) return;
  const followers = [...new Set([...s.followers, ...pubkeys])].slice(-5000);
  useNotifRead.setState({ followers });
  persist({ ...s, followers });
}
