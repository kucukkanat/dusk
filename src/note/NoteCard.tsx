import { memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { use$ } from "applesauce-react/hooks";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { getNip10References } from "applesauce-common/helpers/threading";
import { getContentWarning } from "applesauce-common/helpers/content";
import { eventStore } from "../nostr/core";
import { useEngagement } from "../nostr/engagement";
import { useProfile, nameOf } from "../nostr/profile";
import { useActivePubkey } from "../state/accounts";
import { useSettings, type SwipeAction } from "../state/settings";
import { useFollowing, useMyMutes, isMuted, setBookmark, useMyBookmarks, setMute } from "../nostr/lists";
import { profilePath, eventPath } from "../lib/links";
import { ago, fmtCount, fullDate } from "../lib/format";
import { Icon, type IconName } from "../ui/Icon";
import { AvatarLink, Name, Nip05 } from "../ui/primitives";
import { SwipeRow, type SwipeSide } from "../ui/SwipeRow";
import { RichText } from "./Content";
import { KindBody, hasKindBody } from "./KindBodies";
import { react, unreact, requireSignIn } from "./actions";
import { openCompose } from "../sheets/Compose";
import { openZap } from "../sheets/Zap";
import { openRepost } from "../sheets/Repost";
import { openNoteMenu } from "../sheets/NoteMenu";
import { openReactors, openReactionPicker } from "../sheets/Reactions";
import { toast } from "../state/ui";

const ACTIONS: Record<SwipeAction, { label: string; icon: IconName; tone: string }> = {
  reply: { label: "Reply", icon: "reply", tone: "mist" },
  like: { label: "Like", icon: "like", tone: "rose" },
  repost: { label: "Repost", icon: "repost", tone: "sage" },
  zap: { label: "Zap", icon: "zap", tone: "peach" },
  bookmark: { label: "Bookmark", icon: "bookmark", tone: "butter" },
  mute: { label: "Mute", icon: "mute", tone: "clay" },
};
export const SWIPE_ACTIONS = ACTIONS;

/** Resolve the event inside a repost (embedded JSON, or loaded by its e tag). */
export function useRepostTarget(e: NostrEvent) {
  const embedded = useMemo(() => {
    if (e.kind !== 6 && e.kind !== 16) return undefined;
    try {
      const inner = JSON.parse(e.content) as NostrEvent;
      if (inner && inner.id && inner.sig) return eventStore.add(inner) ?? inner;
    } catch {
      /* not embedded */
    }
    return undefined;
  }, [e]);
  const id = e.kind === 6 || e.kind === 16 ? e.tags.find((t) => t[0] === "e")?.[1] : undefined;
  const relay = e.tags.find((t) => t[0] === "e")?.[2];
  const loaded = use$(() => (!embedded && id ? eventStore.event({ id, relays: relay ? [relay] : undefined }) : undefined), [id, embedded]);
  return embedded ?? loaded;
}

type NoteOpts = { focus?: boolean; inThread?: boolean; preview?: boolean; isNew?: boolean; showMuted?: boolean };

export const NoteCard = memo(function NoteCard({ event, ...o }: { event: NostrEvent } & NoteOpts) {
  if (event.kind === 6 || event.kind === 16) return <Repost event={event} {...o} />;
  return <Note event={event} {...o} />;
});

function Repost({ event, ...o }: { event: NostrEvent } & NoteOpts) {
  const target = useRepostTarget(event);
  if (!target)
    return (
      <div className="border-b border-line bg-surface px-4 py-3 text-[13px] text-muted">
        <Name pubkey={event.pubkey} className="font-semibold" /> reposted a note that couldn't be loaded.
      </div>
    );
  return <Note event={target} by={event.pubkey} {...o} />;
}

function ReplyingTo({ event }: { event: NostrEvent }) {
  const refs = useMemo(() => getNip10References(event), [event]);
  const parentId = refs.reply?.e?.id ?? refs.root?.e?.id;
  const parent = use$(() => (parentId ? eventStore.event(refs.reply?.e ?? refs.root!.e!) : undefined), [parentId]);
  const pk = parent?.pubkey ?? refs.reply?.e?.author ?? event.tags.find((t) => t[0] === "p")?.[1];
  if (!pk) return null;
  return (
    <div className="mb-0.5 flex items-center gap-1 text-[13px] text-muted">
      <Icon name="reply" size={14} />
      Replying to{" "}
      <Link to={profilePath(pk)} className="font-medium text-accent-ink" onClick={(e) => e.stopPropagation()}>
        @<Name pubkey={pk} />
      </Link>
    </div>
  );
}

function Hearts() {
  const hs: [number, number, number, number, string, number][] = [
    [-18, -34, 1, -18, "rose", 0],
    [14, -42, 0.85, 14, "peach", 60],
    [-3, -52, 1.15, -4, "rose", 30],
    [24, -22, 0.7, 22, "lilac", 90],
    [-26, -16, 0.7, -24, "lilac", 120],
    [6, -30, 0.6, 8, "peach", 150],
  ];
  return (
    <span className="pointer-events-none absolute top-1/2 left-[19px] size-0" aria-hidden="true">
      {hs.map(([dx, dy, s, r, tone, d], i) => (
        <svg key={i} viewBox="0 0 24 24" className="absolute -top-1.5 -left-1.5 size-3 fill-current opacity-0" style={{ color: `var(--${tone}-ink)`, ["--dx" as string]: dx + "px", ["--dy" as string]: dy + "px", ["--s" as string]: s, ["--r" as string]: r + "deg", animation: `heart-float 900ms cubic-bezier(.2,.7,.3,1) ${d}ms forwards` }}>
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
        </svg>
      ))}
    </span>
  );
}

function Count({ n }: { n: number }) {
  const hide = useSettings((s) => s.hideCounts);
  return <span className="min-w-[2ch] text-left">{hide || !n ? "" : fmtCount(n)}</span>;
}

export function NoteActions({ event, focus }: { event: NostrEvent; focus?: boolean }) {
  const eng = useEngagement(event);
  const [pop, setPop] = useState(false);
  const oneTap = useSettings((s) => s.oneTapZap);
  const liked = !!eng.myLike;
  const like = () => {
    if (!requireSignIn()) return;
    if (eng.myLike) unreact(eng.myLike);
    else {
      setPop(true);
      setTimeout(() => setPop(false), 900);
      react(event, "+");
    }
  };
  return (
    <div className={`-mx-2 mt-1 -mb-2 flex justify-between ${focus ? "max-w-none" : "max-w-[340px]"}`} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="iconbtn" aria-label={`Reply${eng.replies ? `, ${eng.replies} replies` : ""}`} onClick={() => requireSignIn() && openCompose({ replyTo: event })}>
        <Icon name="reply" />
        <Count n={eng.replies} />
      </button>
      <button type="button" className={`iconbtn ${eng.myRepost ? "text-sage-ink" : ""}`} aria-pressed={!!eng.myRepost} aria-label="Repost" onClick={() => requireSignIn() && openRepost(event, eng.myRepost)}>
        <Icon name="repost" />
        <Count n={eng.reposts} />
      </button>
      <button
        type="button"
        className={`iconbtn relative overflow-visible ${liked ? "text-rose-ink" : ""} ${pop ? "animate-pop" : ""}`}
        aria-pressed={liked}
        aria-label={liked ? "Remove like" : "Like"}
        onClick={like}
        onContextMenu={(e) => {
          e.preventDefault();
          if (requireSignIn()) openReactionPicker(event);
        }}
      >
        <Icon name="like" />
        <Count n={eng.likes} />
        {pop && <Hearts />}
      </button>
      <button type="button" className={`iconbtn ${eng.myZapped ? "text-peach-ink" : ""}`} aria-pressed={eng.myZapped} aria-label="Zap" onClick={() => requireSignIn() && openZap({ event, pubkey: event.pubkey, oneTap })}>
        <Icon name="zap" />
        <Count n={eng.zaps} />
      </button>
      <button type="button" className="iconbtn" aria-label="More options" onClick={() => openNoteMenu(event)}>
        <Icon name="more" />
      </button>
    </div>
  );
}

function ReactionStrip({ event }: { event: NostrEvent }) {
  const eng = useEngagement(event);
  const items = [...eng.reactions.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 8);
  if (!items.length && !eng.zapCount) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
      {items.map(([c, r]) => (
        <button key={c} type="button" className={`chip min-h-8 px-3 text-[14px] ${r.mine ? "border-accent" : ""}`} onClick={() => (r.mine ? eng.myLike && unreact(eng.myLike) : requireSignIn() && react(event, r.url ? { shortcode: c.slice(1, -1), url: r.url } : c))}>
          {r.url ? <img src={r.url} alt={c} className="size-5" /> : c === "+" ? <Icon name="like" size={16} className="text-rose-ink" /> : <span>{c}</span>}
          <span className="text-muted">{r.count}</span>
        </button>
      ))}
      <button type="button" className="chip min-h-8 px-3 text-[14px]" onClick={() => openReactors(event)}>
        See who reacted
      </button>
    </div>
  );
}

function Note({ event, by, focus, inThread, preview, isNew, showMuted }: { event: NostrEvent; by?: string } & NoteOpts) {
  const nav = useNavigate();
  const me = useActivePubkey();
  const settings = useSettings();
  const following = useFollowing(me);
  const mutes = useMyMutes();
  const bookmarks = useMyBookmarks();
  const author = useProfile(event.pubkey);
  const cw = useMemo(() => getContentWarning(event), [event]);
  const [revealed, setRevealed] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const muted = !showMuted && isMuted(event, mutes);
  const isReply = useMemo(() => {
    if (event.kind !== 1) return false;
    const r = getNip10References(event);
    return !!(r.reply || r.root);
  }, [event]);

  if (muted && !showHidden) {
    if (!inThread) return null;
    return (
      <div className="border-b border-line bg-surface px-4 py-3 text-[14px] text-muted">
        Hidden because of your mutes.{" "}
        <button type="button" className="font-medium text-accent-ink" onClick={() => setShowHidden(true)}>
          Show
        </button>
      </div>
    );
  }

  // guests have no follows to judge by, so only "always blur" applies to them
  const stranger = me ? following.size > 0 && !following.has(event.pubkey) && event.pubkey !== me : false;
  const blur = settings.blurMedia === "always" || (settings.blurMedia === "strangers" && stranger) || !!cw;
  const run = (a: SwipeAction) => () => {
    if (a !== "bookmark" && a !== "mute" && !requireSignIn()) return;
    switch (a) {
      case "reply":
        return openCompose({ replyTo: event });
      case "like":
        return react(event, "+");
      case "repost":
        return openRepost(event);
      case "zap":
        return openZap({ event, pubkey: event.pubkey, oneTap: settings.oneTapZap });
      case "bookmark":
        return requireSignIn() && setBookmark(event, !bookmarks.has(event.id));
      case "mute":
        if (!requireSignIn()) return;
        setMute("user", event.pubkey, true).then(() => toast(`Muted ${nameOf(author, event.pubkey)}`, { undo: () => setMute("user", event.pubkey, false) }));
    }
  };
  const side = (a: SwipeAction): SwipeSide => ({ ...ACTIONS[a], label: a === "mute" ? `Mute ${nameOf(author, event.pubkey).split(" ")[0]}` : a === "bookmark" && bookmarks.has(event.id) ? "Unbookmark" : ACTIONS[a].label, run: run(a) });

  const open = () => {
    if (focus || preview) return;
    if (window.getSelection()?.toString()) return;
    nav(eventPath(event));
  };

  const body: ReactNode = hasKindBody(event.kind) ? (
    <KindBody event={event} focus={focus} blur={blur && !revealed} />
  ) : (
    <Clamp on={!focus && !preview}>
      <div className={`mt-1 ${focus ? "text-[18px] leading-7" : "text-base leading-6"}`}>
        <RichText event={event} blurMedia={blur && !revealed} />
      </div>
    </Clamp>
  );

  const card = (
    <article
      tabIndex={preview ? -1 : 0}
      data-note={event.id}
      className={`grid cursor-pointer grid-cols-[40px_1fr] gap-3 bg-surface px-4 outline-offset-[-2px] ${settings.density === "compact" ? "py-3" : "py-4"} ${isNew ? "animate-fade" : ""} ${focus ? "cursor-default" : ""}`}
      onClick={open}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && open()}
    >
      <div className="flex flex-col items-center">
        <AvatarLink pubkey={event.pubkey} />
      </div>
      <div className="min-w-0">
        {by && (
          <div className="mb-0.5 flex items-center gap-1 text-[13px] text-muted">
            <Icon name="repost" size={16} />
            <Link to={profilePath(by)} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
              <Name pubkey={by} />
            </Link>{" "}
            reposted
          </div>
        )}
        <div className="flex min-w-0 items-baseline gap-2">
          <Link to={profilePath(event.pubkey)} className="truncate text-base leading-[22px] font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
            {nameOf(author, event.pubkey)}
          </Link>
          {focus ? <Nip05 pubkey={event.pubkey} /> : <span className="flex-none text-[13px] text-muted tabular-nums" title={fullDate(event.created_at)}>{ago(event.created_at)}</span>}
        </div>
        {isReply && !inThread && <ReplyingTo event={event} />}
        {cw && !revealed ? (
          <button type="button" className="mt-2 flex w-full items-center gap-3 rounded-[14px] border border-line p-3 text-left" onClick={(e) => (e.stopPropagation(), setRevealed(true))}>
            <Icon name="warn" className="text-butter-ink" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">Content warning{typeof cw === "string" && cw ? `: ${cw}` : ""}</span>
              <span className="caption">Tap to show</span>
            </span>
          </button>
        ) : (
          body
        )}
        {focus && (
          <>
            <div className="mt-3 border-t border-line pt-3 text-[13px] text-muted">{fullDate(event.created_at)}</div>
            <ReactionStrip event={event} />
          </>
        )}
        {!preview && <NoteActions event={event} focus={focus} />}
      </div>
    </article>
  );
  if (preview || focus) return card;
  return (
    <SwipeRow start={side(settings.swipeStart)} end={side(settings.swipeEnd)} onLongPress={() => openNoteMenu(event)}>
      {card}
    </SwipeRow>
  );
}

/** Fold very long notes in feeds behind "Show more". */
function Clamp({ on, children }: { on: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tall, setTall] = useState(false);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    if (on && ref.current) setTall(ref.current.scrollHeight > 520);
  }, [on, children]);
  if (!on) return <>{children}</>;
  return (
    <>
      <div ref={ref} className={tall && !open ? "max-h-[420px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_80%,transparent)]" : ""}>
        {children}
      </div>
      {tall && !open && (
        <button type="button" className="mt-1 text-[14px] font-medium text-accent-ink" onClick={(e) => (e.stopPropagation(), setOpen(true))}>
          Show more
        </button>
      )}
    </>
  );
}

/** A list of notes with dividers. */
export function NoteList({ events, inThread, fresh }: { events: NostrEvent[]; inThread?: boolean; fresh?: Set<string> }) {
  return (
    <div className="[&>*+*]:border-t [&>*+*]:border-line">
      {events.map((e) => (
        <NoteCard key={e.id} event={e} inThread={inThread} isNew={fresh?.has(e.id)} />
      ))}
    </div>
  );
}
