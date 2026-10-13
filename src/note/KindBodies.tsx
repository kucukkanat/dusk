import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { use$ } from "applesauce-react/hooks";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { getPollOptions, getPollType, getPollEndsAt, getPollRelays, getPollResponseVotes } from "applesauce-common/helpers/poll";
import { getStreamTitle, getStreamImage, getStreamStatus, getStreamSummary, getStreamHost } from "applesauce-common/helpers/stream";
import { getCalendarEventTitle, getCalendarEventStart, getCalendarEventEnd, getCalendarEventLocations, getCalendarEventImage, getCalendarEventSummary } from "applesauce-common/helpers/calendar-event";
import { getArticleTitle, getArticleImage, getArticleSummary } from "applesauce-common/helpers/article";
import { getBadgeName, getBadgeDescription, getBadgeImage } from "applesauce-common/helpers/badge";
import { getHighlightText, getHighlightSourceUrl, getHighlightComment, getHighlightSourceEventPointer, getHighlightSourceAddressPointer } from "applesauce-common/helpers/highlight";
import { eventStore, pool, readRelays$, uniqRelays, now } from "../nostr/core";
import { publish } from "../nostr/publish";
import { useActivePubkey } from "../state/accounts";
import { errorToast } from "../state/ui";
import { eventPath } from "../lib/links";
import { readingMinutes, hostOf, plural } from "../lib/format";
import { Icon } from "../ui/Icon";
import { Avatar, Name } from "../ui/primitives";
import { RichText, EmbeddedEvent } from "./Content";
import { requireSignIn } from "./actions";

const KINDS = new Set([20, 21, 22, 34235, 34236, 1068, 30023, 30311, 31922, 31923, 30009, 9802, 39089, 30000, 1063]);
export const hasKindBody = (k: number) => KINDS.has(k);

export function KindBody({ event, focus, blur }: { event: NostrEvent; focus?: boolean; blur?: boolean }) {
  switch (event.kind) {
    case 20:
    case 21:
    case 22:
    case 34235:
    case 34236:
    case 1063:
      return <MediaPost event={event} blur={blur} />;
    case 1068:
      return <Poll event={event} />;
    case 30023:
      return <ArticleCard event={event} />;
    case 30311:
      return <LiveCard event={event} />;
    case 31922:
    case 31923:
      return <CalendarCard event={event} />;
    case 30009:
      return <BadgeCard event={event} />;
    case 9802:
      return <Highlight event={event} />;
    case 39089:
    case 30000:
      return <PackCard event={event} />;
    default:
      return <div className={focus ? "text-lg" : ""}>{event.content}</div>;
  }
}

function MediaPost({ event, blur }: { event: NostrEvent; blur?: boolean }) {
  const title = event.tags.find((t) => t[0] === "title")?.[1];
  // NIP-94 file metadata uses plain tags; give RichText an imeta-shaped view
  const shaped = useMemo(() => {
    if (event.kind !== 1063) return event;
    const url = event.tags.find((t) => t[0] === "url")?.[1];
    const m = event.tags.find((t) => t[0] === "m")?.[1];
    return url ? { ...event, tags: [...event.tags, ["imeta", `url ${url}`, ...(m ? [`m ${m}`] : [])]] } : event;
  }, [event]);
  return (
    <div className="mt-1">
      {title && <div className="font-semibold">{title}</div>}
      <RichText event={shaped} blurMedia={blur} />
    </div>
  );
}

function ArticleCard({ event }: { event: NostrEvent }) {
  const title = getArticleTitle(event) ?? "Untitled";
  const image = getArticleImage(event);
  const summary = getArticleSummary(event) ?? event.content.replace(/[#*_>`[\]()!-]/g, "").slice(0, 220);
  return (
    <Link to={eventPath(event)} className="mt-2 block overflow-hidden rounded-[14px] border border-line transition-colors hover:bg-wash" onClick={(e) => e.stopPropagation()}>
      {image && <img src={image} alt="" loading="lazy" decoding="async" className="aspect-[2/1] w-full object-cover" />}
      <span className="block p-3">
        <span className="flex items-center gap-1 text-[13px] text-muted">
          <Icon name="book" size={16} />
          Long read · {readingMinutes(event.content)} min
        </span>
        <span className="mt-1 block text-[17px] leading-6 font-semibold">{title}</span>
        <span className="mt-1 line-clamp-3 block text-[15px] leading-[21px] text-muted">{summary}</span>
      </span>
    </Link>
  );
}

function LiveCard({ event }: { event: NostrEvent }) {
  const status = getStreamStatus(event);
  const host = getStreamHost(event)?.pubkey ?? event.pubkey;
  const image = getStreamImage(event);
  return (
    <Link to={eventPath(event)} className="mt-2 block overflow-hidden rounded-[14px] border border-line hover:bg-wash" onClick={(e) => e.stopPropagation()}>
      <span className="relative block">
        {image ? <img src={image} alt="" loading="lazy" decoding="async" className="aspect-video w-full object-cover" /> : <span className="block aspect-video w-full bg-raised" />}
        <span className={`absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${status === "live" ? "bg-clay text-on-accent" : "bg-bg/80 text-muted"}`}>{status === "live" ? "LIVE" : status === "planned" ? "Planned" : "Ended"}</span>
      </span>
      <span className="block p-3">
        <span className="block font-semibold">{getStreamTitle(event) ?? "Live stream"}</span>
        <span className="mt-1 flex items-center gap-2 text-[13px] text-muted">
          <Avatar pubkey={host} size="xs" />
          <Name pubkey={host} />
        </span>
        {getStreamSummary(event) && <span className="mt-1 line-clamp-2 block text-[14px] text-muted">{getStreamSummary(event)}</span>}
      </span>
    </Link>
  );
}

export function eventTime(event: NostrEvent) {
  const start = getCalendarEventStart(event);
  const end = getCalendarEventEnd(event);
  if (!start) return "";
  const dateOnly = event.kind === 31922;
  const fmt = (t: number) => new Date(t * 1000).toLocaleString(undefined, dateOnly ? { dateStyle: "medium", timeZone: "UTC" } : { dateStyle: "medium", timeStyle: "short" });
  return end && end !== start ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function CalendarCard({ event }: { event: NostrEvent }) {
  const image = getCalendarEventImage(event);
  const loc = getCalendarEventLocations(event)[0];
  return (
    <Link to={eventPath(event)} className="mt-2 block overflow-hidden rounded-[14px] border border-line hover:bg-wash" onClick={(e) => e.stopPropagation()}>
      {image && <img src={image} alt="" loading="lazy" decoding="async" className="aspect-[2/1] w-full object-cover" />}
      <span className="block p-3">
        <span className="flex items-center gap-1 text-[13px] text-muted">
          <Icon name="calendar" size={16} />
          {eventTime(event)}
        </span>
        <span className="mt-1 block text-[17px] leading-6 font-semibold">{getCalendarEventTitle(event) ?? "Event"}</span>
        {loc && (
          <span className="mt-1 flex items-center gap-1 text-[13px] text-muted">
            <Icon name="pin" size={14} />
            {loc}
          </span>
        )}
        {getCalendarEventSummary(event) && <span className="mt-1 line-clamp-2 block text-[14px] text-muted">{getCalendarEventSummary(event)}</span>}
      </span>
    </Link>
  );
}

function BadgeCard({ event }: { event: NostrEvent }) {
  const img = getBadgeImage(event);
  return (
    <Link to={eventPath(event)} className="mt-2 flex items-center gap-3 rounded-[14px] border border-line p-3 hover:bg-wash" onClick={(e) => e.stopPropagation()}>
      {img ? <img src={img.url} alt="" loading="lazy" decoding="async" className="size-14 rounded-[10px] object-cover" /> : <Icon name="badge" size={40} className="text-lilac-ink" />}
      <span className="min-w-0">
        <span className="block font-semibold">{getBadgeName(event) ?? "Badge"}</span>
        <span className="line-clamp-2 block text-[14px] text-muted">{getBadgeDescription(event)}</span>
      </span>
    </Link>
  );
}

function Highlight({ event }: { event: NostrEvent }) {
  const url = getHighlightSourceUrl(event);
  const ep = getHighlightSourceEventPointer(event);
  const ap = getHighlightSourceAddressPointer(event);
  const comment = getHighlightComment(event);
  return (
    <div className="mt-1">
      {comment && <div className="prose-note mb-2">{comment}</div>}
      <blockquote className="border-l-[3px] border-butter pl-3 text-[16px] leading-6 italic">{getHighlightText(event)}</blockquote>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[13px] text-accent-ink" onClick={(e) => e.stopPropagation()}>
          From {hostOf(url)}
        </a>
      )}
      {!url && (ap || ep) && <EmbeddedEvent pointer={(ap ?? ep)!} depth={1} />}
    </div>
  );
}

function PackCard({ event }: { event: NostrEvent }) {
  const title = event.tags.find((t) => t[0] === "title")?.[1] ?? event.tags.find((t) => t[0] === "d")?.[1] ?? "List";
  const people = event.tags.filter((t) => t[0] === "p").map((t) => t[1]);
  return (
    <Link to={eventPath(event)} className="mt-2 block rounded-[14px] border border-line p-3 hover:bg-wash" onClick={(e) => e.stopPropagation()}>
      <span className="flex items-center gap-1 text-[13px] text-muted">
        <Icon name="people" size={16} />
        {event.kind === 39089 ? "Follow pack" : "List"} · {plural(people.length, "person", "people")}
      </span>
      <span className="mt-1 block font-semibold">{title}</span>
      <span className="mt-2 flex -space-x-1.5">
        {people.slice(0, 8).map((p) => (
          <Avatar key={p} pubkey={p} size="sm" className="shadow-[0_0_0_2px_var(--surface)]" />
        ))}
      </span>
    </Link>
  );
}

/* ---------- polls (NIP-88) ---------- */

function Poll({ event }: { event: NostrEvent }) {
  const me = useActivePubkey();
  const options = getPollOptions(event);
  const multi = getPollType(event) === "multiplechoice";
  const endsAt = getPollEndsAt(event);
  const ended = !!endsAt && endsAt < now();
  const relays = useMemo(() => uniqRelays(getPollRelays(event), readRelays$.value).slice(0, 6), [event]);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sub = pool.request(relays, { kinds: [1018], "#e": [event.id], limit: 1000 }, { eventStore, timeout: 6000 } as never).subscribe({ next: (e) => eventStore.add(e), error: () => {} });
    return () => sub.unsubscribe();
  }, [event.id, relays]);
  const responses = use$(() => eventStore.timeline({ kinds: [1018], "#e": [event.id] }), [event.id]);
  const tally = useMemo(() => {
    const latest = new Map<string, NostrEvent>();
    for (const r of responses ?? []) {
      if (endsAt && r.created_at > endsAt) continue;
      const prev = latest.get(r.pubkey);
      if (!prev || prev.created_at < r.created_at) latest.set(r.pubkey, r);
    }
    const counts = new Map<string, number>();
    let mine: string[] = [];
    for (const r of latest.values()) {
      const votes = getPollResponseVotes(event, r) ?? [];
      for (const v of votes) counts.set(v, (counts.get(v) ?? 0) + 1);
      if (r.pubkey === me) mine = votes;
    }
    return { counts, voters: latest.size, mine };
  }, [responses, event, me, endsAt]);
  const voted = tally.mine.length > 0;
  const showResults = voted || ended;

  const vote = async (ids: string[]) => {
    if (!requireSignIn() || !ids.length) return;
    setBusy(true);
    try {
      await publish({ kind: 1018, content: "", tags: [["e", event.id], ...ids.map((id) => ["response", id])] }, { relays, notifyTagged: false });
    } catch (e) {
      errorToast(e, "Couldn't vote");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
      <div className="prose-note">{event.content}</div>
      <div className="mt-3 grid gap-2">
        {options.map((o) => {
          const n = tally.counts.get(o.id) ?? 0;
          const pct = tally.voters ? Math.round((n / tally.voters) * 100) : 0;
          const mine = tally.mine.includes(o.id);
          const sel = picked.includes(o.id);
          return showResults ? (
            <div key={o.id} className="relative overflow-hidden rounded-[10px] border border-line px-3 py-2">
              <span className="absolute inset-y-0 left-0 bg-wash" style={{ width: pct + "%" }} />
              <span className="relative flex items-center gap-2 text-[15px]">
                {mine && <Icon name="check" size={16} className="text-accent-ink" />}
                <span className="flex-1">{o.label}</span>
                <span className="text-muted tabular-nums">{pct}%</span>
              </span>
            </div>
          ) : (
            <button
              key={o.id}
              type="button"
              disabled={busy}
              className={`rounded-[10px] border px-3 py-2 text-left text-[15px] transition-colors ${sel ? "border-accent bg-wash" : "border-line hover:bg-wash"}`}
              onClick={() => (multi ? setPicked(sel ? picked.filter((x) => x !== o.id) : [...picked, o.id]) : vote([o.id]))}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[13px] text-muted">
        <span>{plural(tally.voters, "vote")}</span>
        {endsAt && <span>· {ended ? "Ended" : `Ends ${new Date(endsAt * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}</span>}
        {multi && !showResults && (
          <button type="button" className="btn btn-primary btn-sm ml-auto" disabled={!picked.length || busy} onClick={() => vote(picked)}>
            Vote
          </button>
        )}
      </div>
    </div>
  );
}

