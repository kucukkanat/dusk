import { useEffect, useMemo } from "react";
import { use$ } from "applesauce-react/hooks";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { getReplaceableAddressForEvent } from "applesauce-core/helpers/pointers";
import { getZapAmount, getZapSender } from "applesauce-common/helpers/zap";
import { getNip10References } from "applesauce-common/helpers/threading";
import { eventStore, pool, readRelays$, uniqRelays, DEFAULT_RELAYS } from "./core";
import { hintFor } from "./relays";
import { chunk } from "./timeline";
import { useActivePubkey } from "../state/accounts";

/* Batch requests for reactions, reposts, zaps and replies of the notes on screen. */
const queue = new Map<string, NostrEvent>();
const done = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const events = [...queue.values()];
  queue.clear();
  if (!events.length) return;
  const ids = events.filter((e) => !(e.kind >= 30000 && e.kind < 40000)).map((e) => e.id);
  const addrs = events.map((e) => getReplaceableAddressForEvent(e)).filter((a): a is string => !!a);
  // reactions usually land on the author's relays (their inbox) and on big relays
  const relays = uniqRelays(readRelays$.value, DEFAULT_RELAYS, events.map((e) => hintFor(e.pubkey)).filter((x): x is string => !!x)).slice(0, 10);
  const filters = [
    ...chunk(ids, 100).map((c) => ({ kinds: [1, 6, 7, 16, 9735, 1111], "#e": c, limit: 1500 })),
    ...chunk(addrs, 100).map((c) => ({ kinds: [1, 7, 9735, 1111], "#a": c, limit: 500 })),
  ];
  if (!filters.length) return;
  pool.request(relays, filters, { eventStore, timeout: 8000 } as never).subscribe({ next: (e) => eventStore.add(e), error: () => {} });
}

export function requestEngagement(e: NostrEvent) {
  if (done.has(e.id)) return;
  done.add(e.id);
  queue.set(e.id, e);
  if (!timer) timer = setTimeout(flush, 350);
}

export type Engagement = {
  likes: number;
  reposts: number;
  replies: number;
  zaps: number;
  zapCount: number;
  myLike?: NostrEvent;
  myRepost?: NostrEvent;
  myZapped: boolean;
  reactions: Map<string, { count: number; url?: string; mine: boolean }>;
  reactionEvents: NostrEvent[];
  zapEvents: NostrEvent[];
};

export function useEngagement(e: NostrEvent | undefined, load = true): Engagement {
  const me = useActivePubkey();
  useEffect(() => {
    if (e && load) requestEngagement(e);
  }, [e, load]);
  const addr = e ? getReplaceableAddressForEvent(e) : null;
  const related = use$(
    () => (e ? eventStore.timeline(addr ? [{ "#a": [addr] }, { "#e": [e.id] }] : { "#e": [e.id] }) : undefined),
    [e?.id, addr],
  );
  return useMemo(() => {
    const out: Engagement = { likes: 0, reposts: 0, replies: 0, zaps: 0, zapCount: 0, myZapped: false, reactions: new Map(), reactionEvents: [], zapEvents: [] };
    if (!e || !related) return out;
    const seenReactors = new Set<string>();
    for (const r of related) {
      if (r.kind === 7) {
        // the reacted-to note is the last e tag
        const target = [...r.tags].reverse().find((t) => t[0] === "e")?.[1];
        if (target && target !== e.id && !addr) continue;
        const key = r.pubkey + ":" + r.content;
        if (seenReactors.has(key)) continue;
        seenReactors.add(key);
        out.reactionEvents.push(r);
        const c = r.content === "+" || r.content === "" ? "+" : r.content;
        if (c === "-") continue;
        out.likes++;
        const emojiUrl = c.startsWith(":") ? r.tags.find((t) => t[0] === "emoji" && `:${t[1]}:` === c)?.[2] : undefined;
        const cur = out.reactions.get(c) ?? { count: 0, url: emojiUrl, mine: false };
        cur.count++;
        if (r.pubkey === me) {
          cur.mine = true;
          out.myLike = r;
        }
        out.reactions.set(c, cur);
      } else if (r.kind === 6 || r.kind === 16) {
        out.reposts++;
        if (r.pubkey === me) out.myRepost = r;
      } else if (r.kind === 9735) {
        const amt = getZapAmount(r);
        if (amt) {
          out.zaps += Math.round(amt / 1000);
          out.zapCount++;
          out.zapEvents.push(r);
          if (getZapSender(r) === me) out.myZapped = true;
        }
      } else if (r.kind === 1 || r.kind === 1111) {
        if (r.kind === 1) {
          const refs = getNip10References(r);
          const parent = refs.reply?.e?.id ?? refs.root?.e?.id;
          if (parent === e.id) out.replies++;
          else if (r.tags.some((t) => t[0] === "q" && t[1] === e.id)) out.reposts++;
        } else out.replies++;
      }
    }
    return out;
  }, [related, e, me, addr]);
}
