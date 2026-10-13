import { useEffect, useMemo, useState } from "react";
import { use$ } from "applesauce-react/hooks";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { getZapAmount, getZapSender, getZapRequest } from "applesauce-common/helpers/zap";
import { eventStore, readRelays$, uniqRelays, DEFAULT_RELAYS } from "../nostr/core";
import { requestAll } from "../nostr/timeline";
import { useEngagement } from "../nostr/engagement";
import { useActivePubkey } from "../state/accounts";
import { openSheet, closeSheet } from "../state/ui";
import { react } from "../note/actions";
import { PersonRow } from "../ui/PersonRow";
import { Icon } from "../ui/Icon";
import { sats } from "../lib/format";

const COMMON = ["❤️", "🤙", "🔥", "😂", "🫂", "👀", "🙏", "💯", "⚡", "🎉", "😮", "😢", "🤔", "👏", "🌙", "✨"];

export function openReactionPicker(event: NostrEvent) {
  openSheet(<Picker event={event} />, { label: "React" });
}
export function openReactors(event: NostrEvent) {
  openSheet(<Reactors event={event} />, { label: "Reactions" });
}

/** Custom emoji from the signed-in person's emoji list (NIP-30, kind 10030) and the packs it points at. */
function useMyEmoji() {
  const me = useActivePubkey();
  const list = use$(() => (me ? eventStore.replaceable(10030, me) : undefined), [me]);
  const packs = useMemo(() => (list?.tags.filter((t) => t[0] === "a" && t[1]?.startsWith("30030:")).map((t) => t[1]) ?? []).slice(0, 10), [list]);
  const filters = useMemo(
    () =>
      packs.map((a) => {
        const [, pk, ...d] = a.split(":");
        return { kinds: [30030], authors: [pk], "#d": [d.join(":")] };
      }),
    [packs.join(",")], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => {
    if (filters.length) requestAll(uniqRelays(readRelays$.value, DEFAULT_RELAYS), filters, 5000);
  }, [filters]);
  const packEvents = use$(() => (filters.length ? eventStore.timeline(filters) : undefined), [filters]);
  return useMemo(() => {
    const out: { shortcode: string; url: string }[] = [];
    const seen = new Set<string>();
    for (const ev of [list, ...(packEvents ?? [])])
      for (const t of ev?.tags ?? [])
        if (t[0] === "emoji" && t[1] && t[2] && !seen.has(t[1])) {
          seen.add(t[1]);
          out.push({ shortcode: t[1], url: t[2] });
        }
    return out;
  }, [list, packEvents]);
}

function Picker({ event }: { event: NostrEvent }) {
  const custom = useMyEmoji();
  const [q, setQ] = useState("");
  const pick = (e: string | { shortcode: string; url: string }) => {
    closeSheet();
    react(event, e);
  };
  const filtered = custom.filter((c) => c.shortcode.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="grid gap-3">
      <h2 className="text-xl font-semibold">React</h2>
      <div className="grid grid-cols-8 gap-1">
        {COMMON.map((e) => (
          <button key={e} type="button" className="grid aspect-square place-items-center rounded-[10px] text-2xl hover:bg-wash" onClick={() => pick(e)} aria-label={"React with " + e}>
            {e}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = q.trim();
          if (v && /\p{Extended_Pictographic}/u.test(v)) pick(v);
        }}
      >
        <input className="field" placeholder={custom.length ? "Search your emoji, or type one" : "Type any emoji"} value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      {filtered.length > 0 && (
        <div className="grid max-h-60 grid-cols-8 gap-1 overflow-y-auto">
          {filtered.map((c) => (
            <button key={c.shortcode} type="button" className="grid aspect-square place-items-center rounded-[10px] hover:bg-wash" title={":" + c.shortcode + ":"} onClick={() => pick(c)}>
              <img src={c.url} alt={c.shortcode} className="size-7 object-contain" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Reactors({ event }: { event: NostrEvent }) {
  const eng = useEngagement(event);
  const [tab, setTab] = useState<"likes" | "zaps" | "reposts">("likes");
  const reposts = use$(() => eventStore.timeline({ kinds: [6, 16], "#e": [event.id] }), [event.id]) ?? [];
  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        {(
          [
            ["likes", `Reactions ${eng.reactionEvents.length || ""}`],
            ["zaps", `Zaps ${eng.zapCount || ""}`],
            ["reposts", `Reposts ${reposts.length || ""}`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" className="chip" aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="-mx-5 [&>*+*]:border-t [&>*+*]:border-line">
        {tab === "likes" &&
          eng.reactionEvents.map((r) => {
            const url = r.content.startsWith(":") ? r.tags.find((t) => t[0] === "emoji")?.[2] : undefined;
            return (
              <PersonRow key={r.id} pubkey={r.pubkey} onNavigate={() => closeSheet()} right={<span className="text-xl">{url ? <img src={url} alt={r.content} className="size-6" /> : r.content === "+" || !r.content ? <Icon name="like" className="text-rose-ink" /> : r.content}</span>} />
            );
          })}
        {tab === "zaps" &&
          eng.zapEvents
            .slice()
            .sort((a, b) => (getZapAmount(b) ?? 0) - (getZapAmount(a) ?? 0))
            .map((z) => {
              const who = getZapSender(z) ?? z.pubkey;
              return <PersonRow key={z.id} pubkey={who} sub={getZapRequest(z)?.content || undefined} onNavigate={() => closeSheet()} right={<span className="flex items-center gap-1 text-[14px] font-medium text-peach-ink">
                    <Icon name="zap" size={16} />
                    {sats(Math.round((getZapAmount(z) ?? 0) / 1000))}
                  </span>} />;
            })}
        {tab === "reposts" && reposts.map((r) => <PersonRow key={r.id} pubkey={r.pubkey} onNavigate={() => closeSheet()} />)}
        {((tab === "likes" && !eng.reactionEvents.length) || (tab === "zaps" && !eng.zapCount) || (tab === "reposts" && !reposts.length)) && <p className="px-5 py-6 text-center text-[14px] text-muted">Nothing yet.</p>}
      </div>
    </div>
  );
}
