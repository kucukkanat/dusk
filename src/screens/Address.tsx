import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router";
import { use$ } from "applesauce-react/hooks";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { getReplaceableAddressForEvent } from "applesauce-core/helpers/pointers";
import { getArticleTitle, getArticleImage, getArticleSummary, getArticlePublished } from "applesauce-common/helpers/article";
import { getStreamTitle, getStreamStatus, getStreamStreamingURLs, getStreamRecording, getStreamImage, getStreamSummary, getStreamHost, getStreamRelays, getStreamViewers } from "applesauce-common/helpers/stream";
import { getCalendarEventTitle, getCalendarEventImage, getCalendarEventSummary, getCalendarEventLocations } from "applesauce-common/helpers/calendar-event";
import { getRSVPStatus } from "applesauce-common/helpers/calendar-rsvp";
import { getBadgeName, getBadgeDescription, getBadgeImage } from "applesauce-common/helpers/badge";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { eventStore, readRelays$, uniqRelays, DEFAULT_RELAYS, pool, now } from "../nostr/core";
import { requestAll } from "../nostr/timeline";
import { outboxesOf } from "../nostr/relays";
import { publish } from "../nostr/publish";
import { useEngagement } from "../nostr/engagement";
import { useMyBookmarks, setBookmark, followMany, useFollowing } from "../nostr/lists";
import { useActivePubkey } from "../state/accounts";
import { decodeAny, profilePath, pathFor } from "../lib/links";
import { displayName } from "../nostr/profile";
import { readingMinutes, agoLong, plural, ago } from "../lib/format";
import { errorToast, toast } from "../state/ui";
import { Screen } from "../ui/Screen";
import { Empty, Spinner, AvatarLink, Name, Avatar } from "../ui/primitives";
import { PersonRow } from "../ui/PersonRow";
import { NoteCard } from "../note/NoteCard";
import { Icon } from "../ui/Icon";
import { react, unreact, requireSignIn } from "../note/actions";
import { openZap } from "../sheets/Zap";
import { openCompose } from "../sheets/Compose";
import { openNoteMenu } from "../sheets/NoteMenu";
import { eventTime } from "../note/KindBodies";
import { RichText } from "../note/Content";

export function Address() {
  const { id = "" } = useParams();
  const d = useMemo(() => decodeAny(id), [id]);
  const pointer = d.type === "address" ? d.pointer : undefined;
  const ev = use$(() => (pointer ? eventStore.addressable(pointer) : undefined), [id]);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!pointer) return;
    // ask the author's own relays too
    outboxesOf(pointer.pubkey, 2000).then((r) => requestAll(uniqRelays(r, pointer.relays ?? [], readRelays$.value), [{ kinds: [pointer.kind], authors: [pointer.pubkey], "#d": [pointer.identifier] }], 6000));
    const t = setTimeout(() => setTimedOut(true), 9000);
    return () => clearTimeout(t);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pointer)
    return (
      <Screen back title="">
        <Empty title="Can't open this">That link doesn't point to anything Dusk can show.</Empty>
      </Screen>
    );
  if (!ev)
    return (
      <Screen back title="">
        {timedOut ? <Empty title="Not found">None of the servers Dusk asked have this.</Empty> : <Spinner />}
      </Screen>
    );
  switch (ev.kind) {
    case 30023:
      return <Article event={ev} />;
    case 30311:
      return <Live event={ev} />;
    case 31922:
    case 31923:
      return <CalendarEvent event={ev} />;
    case 30009:
      return <Badge event={ev} />;
    case 39089:
    case 30000:
      return <Pack event={ev} />;
    default:
      return (
        <Screen back title="Details">
          <NoteCard event={ev} focus />
        </Screen>
      );
  }
}

/* ---------- articles (NIP-23) ---------- */

function renderMarkdown(md: string) {
  const withLinks = md.replace(/nostr:((?:npub|nprofile|note|nevent|naddr)1[02-9ac-hj-np-z]+)/g, (_m, code: string) => {
    const p = pathFor(code);
    const d = decodeAny(code);
    const label = d.type === "profile" ? "@" + displayName(d.pointer.pubkey) : code.slice(0, 16) + "…";
    return p ? `[${label}](#${p})` : code;
  });
  return DOMPurify.sanitize(marked.parse(withLinks, { async: false, breaks: false, gfm: true }) as string);
}

function Comments({ event }: { event: NostrEvent }) {
  const addr = getReplaceableAddressForEvent(event);
  useEffect(() => {
    if (addr) requestAll(uniqRelays(readRelays$.value, DEFAULT_RELAYS), [{ kinds: [1, 1111], "#a": [addr], limit: 200 }], 6000);
  }, [addr]);
  const comments = use$(() => (addr ? eventStore.timeline({ kinds: [1, 1111], "#a": [addr] }) : undefined), [addr]) ?? [];
  const sorted = [...comments].sort((a, b) => a.created_at - b.created_at);
  return (
    <section className="mt-6 border-t border-line">
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">{sorted.length ? plural(sorted.length, "comment") : "Comments"}</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => requireSignIn() && openCompose({ replyTo: event })}>
          <Icon name="reply" size={18} />
          Comment
        </button>
      </div>
      <div className="[&>*+*]:border-t [&>*+*]:border-line">
        {sorted.map((c) => (
          <NoteCard key={c.id} event={c} inThread />
        ))}
      </div>
    </section>
  );
}

function Article({ event }: { event: NostrEvent }) {
  const eng = useEngagement(event);
  const bookmarks = useMyBookmarks();
  const addr = getReplaceableAddressForEvent(event)!;
  const bookmarked = bookmarks.has(addr) || bookmarks.has(event.id);
  const html = useMemo(() => renderMarkdown(event.content), [event.content]);
  const image = getArticleImage(event);
  return (
    <Screen
      back
      title=""
      actions={
        <>
          <button type="button" className="iconbtn" aria-pressed={bookmarked} aria-label={bookmarked ? "Remove bookmark" : "Bookmark"} onClick={() => requireSignIn() && setBookmark(event, !bookmarked)}>
            <Icon name="bookmark" />
          </button>
          <button type="button" className="iconbtn" aria-label="More options" onClick={() => openNoteMenu(event)}>
            <Icon name="more" />
          </button>
        </>
      }
    >
      <article className="bg-surface px-5 pt-4 pb-8">
        {image && <img src={image} alt="" className="mb-5 aspect-[2/1] w-full rounded-[14px] object-cover" />}
        <h1 className="text-[28px] leading-[34px] font-semibold">{getArticleTitle(event) ?? "Untitled"}</h1>
        {getArticleSummary(event) && <p className="mt-2 text-[17px] leading-[26px] text-muted">{getArticleSummary(event)}</p>}
        <div className="mt-4 flex items-center gap-3">
          <AvatarLink pubkey={event.pubkey} />
          <span className="text-[14px]">
            <Link to={profilePath(event.pubkey)} className="block font-semibold hover:underline">
              <Name pubkey={event.pubkey} />
            </Link>
            <span className="text-muted">
              {readingMinutes(event.content)} min read · {agoLong(getArticlePublished(event))}
            </span>
          </span>
        </div>
        <div className="article-body mt-6 text-[17px] leading-[28px]" dangerouslySetInnerHTML={{ __html: html }} />
        <div className="mt-8 flex flex-wrap gap-2">
          <button type="button" className={`btn btn-secondary ${eng.myLike ? "text-rose-ink" : ""}`} onClick={() => requireSignIn() && (eng.myLike ? unreact(eng.myLike) : react(event))}>
            <Icon name="like" size={18} />
            {eng.myLike ? "Liked" : "Like"}
            {eng.likes ? ` · ${eng.likes}` : ""}
          </button>
          <button type="button" className="btn btn-zap" onClick={() => requireSignIn() && openZap({ pubkey: event.pubkey, event })}>
            <Icon name="zap" size={18} />
            Zap {displayName(event.pubkey).split(" ")[0]}
            {eng.zaps ? ` · ${eng.zaps}` : ""}
          </button>
        </div>
      </article>
      <Comments event={event} />
    </Screen>
  );
}

/* ---------- live streams (NIP-53) ---------- */

function Player({ urls, poster }: { urls: string[]; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const url = urls[0];
  useEffect(() => {
    const v = ref.current;
    if (!v || !url) return;
    if (url.includes(".m3u8") && !v.canPlayType("application/vnd.apple.mpegurl")) {
      let hls: { destroy(): void } | null = null;
      import("hls.js").then(({ default: Hls }) => {
        if (!Hls.isSupported()) return;
        const h = new Hls();
        h.loadSource(url);
        h.attachMedia(v);
        hls = h;
      });
      return () => hls?.destroy();
    }
    v.src = url;
  }, [url]);
  if (!url) return poster ? <img src={poster} alt="" className="aspect-video w-full object-cover" /> : <div className="aspect-video w-full bg-black" />;
  return <video ref={ref} controls playsInline autoPlay muted poster={poster} className="aspect-video w-full bg-black" />;
}

function Live({ event }: { event: NostrEvent }) {
  const me = useActivePubkey();
  const addr = getReplaceableAddressForEvent(event)!;
  const status = getStreamStatus(event);
  const host = getStreamHost(event)?.pubkey ?? event.pubkey;
  const relays = useMemo(() => uniqRelays(getStreamRelays(event) ?? [], readRelays$.value).slice(0, 6), [event]);
  const [text, setText] = useState("");
  useEffect(() => {
    const req = pool.request(relays, { kinds: [1311, 9735], "#a": [addr], limit: 200 }, { eventStore, timeout: 6000 } as never).subscribe({ next: (e) => eventStore.add(e), error: () => {} });
    const live = pool.subscription(relays, { kinds: [1311, 9735], "#a": [addr], since: now() }).subscribe({ next: (e) => eventStore.add(e), error: () => {} });
    return () => (req.unsubscribe(), live.unsubscribe());
  }, [addr, relays]);
  const chat = use$(() => eventStore.timeline({ kinds: [1311], "#a": [addr] }), [addr]) ?? [];
  const sorted = [...chat].sort((a, b) => a.created_at - b.created_at).slice(-200);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [sorted.length]);
  const send = async () => {
    if (!text.trim() || !requireSignIn()) return;
    const t = text.trim();
    setText("");
    try {
      await publish({ kind: 1311, content: t, tags: [["a", addr, relays[0] ?? ""]] }, { relays, notifyTagged: false });
    } catch (e) {
      errorToast(e, "Couldn't send");
    }
  };
  const urls = status === "ended" ? [getStreamRecording(event)].filter((x): x is string => !!x) : getStreamStreamingURLs(event);
  return (
    <Screen
      back
      title={getStreamTitle(event) ?? "Live"}
      chat
      footer={
        <form
          className="flex flex-none gap-2 border-t border-line bg-bg px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input className="field min-h-11 flex-1 rounded-full py-2" placeholder={me ? "Say something" : "Sign in to chat"} value={text} onChange={(e) => setText(e.target.value)} />
          <button type="button" className="iconbtn" aria-label="Zap the host" onClick={() => requireSignIn() && openZap({ pubkey: host, event })}>
            <Icon name="zap" />
          </button>
          <button type="submit" className="grid size-11 place-items-center rounded-full bg-accent text-on-accent disabled:opacity-40" aria-label="Send" disabled={!text.trim()}>
            <Icon name="send" />
          </button>
        </form>
      }
    >
      <Player urls={urls} poster={getStreamImage(event)} />
      <div className="bg-surface px-4 py-3">
        <div className="flex items-center gap-2 text-[13px]">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${status === "live" ? "bg-clay text-on-accent" : "bg-raised text-muted"}`}>{status === "live" ? "LIVE" : status === "planned" ? "Planned" : "Ended"}</span>
          {getStreamViewers(event) != null && <span className="text-muted">{plural(getStreamViewers(event)!, "viewer")}</span>}
        </div>
        <h1 className="mt-2 text-[20px] font-semibold">{getStreamTitle(event)}</h1>
        <Link to={profilePath(host)} className="mt-2 flex items-center gap-2 text-[14px]">
          <Avatar pubkey={host} size="sm" />
          <Name pubkey={host} className="font-semibold" />
        </Link>
        {getStreamSummary(event) && <p className="mt-2 text-[14px] text-muted">{getStreamSummary(event)}</p>}
      </div>
      <div className="grid gap-2 px-4 py-3">
        {sorted.map((m) => (
          <div key={m.id} className="flex gap-2 text-[14px] leading-5">
            <Avatar pubkey={m.pubkey} size="xs" className="mt-0.5" />
            <span className="min-w-0">
              <Link to={profilePath(m.pubkey)} className="mr-1.5 font-semibold">
                {displayName(m.pubkey)}
              </Link>
              <span className="prose-note">
                <RichText event={m} inline />
              </span>
            </span>
          </div>
        ))}
        {!sorted.length && <p className="py-6 text-center text-[14px] text-muted">No chat yet.</p>}
        <div ref={endRef} />
      </div>
    </Screen>
  );
}

/* ---------- calendar events (NIP-52) ---------- */

function CalendarEvent({ event }: { event: NostrEvent }) {
  const me = useActivePubkey();
  const addr = getReplaceableAddressForEvent(event)!;
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    requestAll(uniqRelays(readRelays$.value, DEFAULT_RELAYS), [{ kinds: [31925], "#a": [addr], limit: 500 }], 6000);
  }, [addr]);
  const rsvps = use$(() => eventStore.timeline({ kinds: [31925], "#a": [addr] }), [addr]) ?? [];
  const latest = useMemo(() => {
    const m = new Map<string, NostrEvent>();
    for (const r of rsvps) if (!m.has(r.pubkey) || m.get(r.pubkey)!.created_at < r.created_at) m.set(r.pubkey, r);
    return m;
  }, [rsvps]);
  const going = [...latest.values()].filter((r) => getRSVPStatus(r) === "accepted").map((r) => r.pubkey);
  const maybe = [...latest.values()].filter((r) => getRSVPStatus(r) === "tentative").map((r) => r.pubkey);
  const mine = me ? latest.get(me) : undefined;
  const myStatus = mine ? getRSVPStatus(mine) : undefined;
  const rsvp = async (status: "accepted" | "tentative" | "declined") => {
    if (!requireSignIn()) return;
    setBusy(true);
    try {
      const d = mine?.tags.find((t) => t[0] === "d")?.[1] ?? Math.random().toString(36).slice(2);
      await publish({ kind: 31925, content: "", tags: [["d", d], ["a", addr], ["e", event.id], ["status", status], ["p", event.pubkey]] });
      toast(status === "accepted" ? "You're going" : status === "tentative" ? "Marked as maybe" : "You're not going");
    } catch (e) {
      errorToast(e, "Couldn't RSVP");
    } finally {
      setBusy(false);
    }
  };
  const image = getCalendarEventImage(event);
  const locs = getCalendarEventLocations(event);
  return (
    <Screen back title="Event">
      <div className="bg-surface pb-4">
        {image && <img src={image} alt="" className="aspect-[2/1] w-full object-cover" />}
        <div className="px-4 pt-4">
          <p className="flex items-center gap-1 text-[14px] text-muted">
            <Icon name="calendar" size={16} />
            {eventTime(event)}
          </p>
          <h1 className="mt-1 text-[24px] leading-[30px] font-semibold">{getCalendarEventTitle(event) ?? "Event"}</h1>
          {locs.map((l) => (
            <p key={l} className="mt-1 flex items-center gap-1 text-[14px] text-muted">
              <Icon name="pin" size={16} />
              {/^https?:/.test(l) ? (
                <a href={l} target="_blank" rel="noreferrer" className="text-accent-ink">
                  {l}
                </a>
              ) : (
                l
              )}
            </p>
          ))}
          <Link to={profilePath(event.pubkey)} className="mt-3 flex items-center gap-2 text-[14px]">
            <Avatar pubkey={event.pubkey} size="sm" />
            Hosted by <Name pubkey={event.pubkey} className="font-semibold" />
          </Link>
          {(getCalendarEventSummary(event) || event.content) && <div className="prose-note mt-4 text-[15px] leading-[22px]">{event.content || getCalendarEventSummary(event)}</div>}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(
              [
                ["accepted", "Going"],
                ["tentative", "Maybe"],
                ["declined", "Can't go"],
              ] as const
            ).map(([s, l]) => (
              <button key={s} type="button" className="chip justify-center" aria-pressed={myStatus === s} disabled={busy} onClick={() => rsvp(s)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 pt-6 pb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
        {going.length} going{maybe.length ? ` · ${maybe.length} maybe` : ""}
      </div>
      <div className="[&>*+*]:border-t [&>*+*]:border-line">
        {[...going, ...maybe].map((p) => (
          <PersonRow key={p} pubkey={p} sub={maybe.includes(p) ? "Maybe" : undefined} />
        ))}
      </div>
    </Screen>
  );
}

/* ---------- badges (NIP-58) ---------- */

function Badge({ event }: { event: NostrEvent }) {
  const addr = getReplaceableAddressForEvent(event)!;
  useEffect(() => {
    requestAll(uniqRelays(readRelays$.value, DEFAULT_RELAYS), [{ kinds: [8], "#a": [addr], limit: 300 }], 6000);
  }, [addr]);
  const awards = use$(() => eventStore.timeline({ kinds: [8], "#a": [addr] }), [addr]) ?? [];
  const recipients = [...new Set(awards.filter((a) => a.pubkey === event.pubkey).flatMap((a) => a.tags.filter((t) => t[0] === "p").map((t) => t[1])))];
  const img = getBadgeImage(event);
  return (
    <Screen back title="Badge">
      <div className="grid justify-items-center gap-2 bg-surface px-4 py-8 text-center">
        {img ? <img src={img.url} alt="" className="size-32 rounded-[24px] object-cover" /> : <Icon name="badge" size={96} className="text-lilac-ink" />}
        <h1 className="text-[22px] font-semibold">{getBadgeName(event) ?? "Badge"}</h1>
        <p className="max-w-md text-[15px] text-muted">{getBadgeDescription(event)}</p>
        <p className="text-[14px]">
          Made by{" "}
          <Link to={profilePath(event.pubkey)} className="font-semibold text-accent-ink">
            <Name pubkey={event.pubkey} />
          </Link>
        </p>
      </div>
      <div className="px-4 pt-6 pb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">Awarded to {plural(recipients.length, "person", "people")}</div>
      <div className="[&>*+*]:border-t [&>*+*]:border-line">
        {recipients.slice(0, 200).map((p) => (
          <PersonRow key={p} pubkey={p} />
        ))}
      </div>
    </Screen>
  );
}

/* ---------- follow packs and lists ---------- */

function Pack({ event }: { event: NostrEvent }) {
  const me = useActivePubkey();
  const following = useFollowing(me);
  const people = event.tags.filter((t) => t[0] === "p").map((t) => t[1]);
  const title = event.tags.find((t) => t[0] === "title")?.[1] ?? event.tags.find((t) => t[0] === "d")?.[1] ?? "List";
  const desc = event.tags.find((t) => t[0] === "description")?.[1];
  const missing = people.filter((p) => !following.has(p) && p !== me);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const need = people.filter((p) => !eventStore.hasReplaceable(0, p));
    if (need.length) requestAll(uniqRelays(readRelays$.value, DEFAULT_RELAYS, ["wss://purplepag.es"]), [{ kinds: [0], authors: need }], 5000);
  }, [event.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen back title={title}>
      <div className="bg-surface px-4 py-4">
        <p className="text-[13px] text-muted">
          {event.kind === 39089 ? "Follow pack" : "List"} by <Name pubkey={event.pubkey} className="font-semibold text-ink" /> · {ago(event.created_at)}
        </p>
        <h1 className="mt-1 text-[22px] font-semibold">{title}</h1>
        {desc && <p className="mt-1 text-[15px] text-muted">{desc}</p>}
        {missing.length > 0 && (
          <button
            type="button"
            className="btn btn-primary mt-3"
            disabled={busy}
            onClick={async () => {
              if (!requireSignIn()) return;
              setBusy(true);
              try {
                await followMany(missing);
                toast(`Following ${plural(missing.length, "more person", "more people")}`);
              } catch (e) {
                errorToast(e, "Couldn't follow");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Following…" : `Follow all ${missing.length}`}
          </button>
        )}
      </div>
      <div className="[&>*+*]:border-t [&>*+*]:border-line">
        {people.map((p) => (
          <PersonRow key={p} pubkey={p} />
        ))}
      </div>
    </Screen>
  );
}
