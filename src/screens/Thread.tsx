import { useEffect, useMemo, useState } from "react";
import { useParams, Navigate } from "react-router";
import { use$ } from "applesauce-react/hooks";
import type { NostrEvent } from "applesauce-core/helpers/event";
import type { EventPointer } from "applesauce-core/helpers/pointers";
import { getNip10References } from "applesauce-common/helpers/threading";
import { eventStore, readRelays$, uniqRelays, DEFAULT_RELAYS } from "../nostr/core";
import { inboxesOf, outboxesOf } from "../nostr/relays";
import { requestAll } from "../nostr/timeline";
import { useWot } from "../nostr/wot";
import { useActivePubkey } from "../state/accounts";
import { decodeAny, isAddressable } from "../lib/links";
import { naddrEncode } from "nostr-tools/nip19";
import { Screen } from "../ui/Screen";
import { NoteCard } from "../note/NoteCard";
import { Empty, Endcap, Avatar, FeedSkeleton } from "../ui/primitives";
import { Icon } from "../ui/Icon";
import { openCompose } from "../sheets/Compose";
import { openNoteMenu } from "../sheets/NoteMenu";
import { requireSignIn } from "../note/actions";
import { displayName } from "../nostr/profile";
import { plural } from "../lib/format";

function parentPointer(e: NostrEvent): EventPointer | undefined {
  if (e.kind === 1111) {
    const t = e.tags.find((x) => x[0] === "e");
    return t ? { id: t[1], relays: t[2] ? [t[2]] : undefined } : undefined;
  }
  const refs = getNip10References(e);
  return refs.reply?.e ?? refs.root?.e;
}

/** Walk up the reply chain, loading each parent as needed. */
function Ancestors({ event }: { event: NostrEvent }) {
  const p = useMemo(() => parentPointer(event), [event]);
  const parent = use$(() => (p ? eventStore.event(p) : undefined), [p?.id]);
  if (!p) return null;
  if (!parent)
    return (
      <div className="flex items-center gap-2 bg-surface px-4 py-3 text-[14px] text-muted">
        <span className="spinner size-4" /> Loading earlier replies…
      </div>
    );
  return (
    <>
      <Ancestors event={parent} />
      <div className="relative">
        <span className="absolute top-14 bottom-0 left-[35px] z-[2] w-0.5 bg-line" aria-hidden="true" />
        <NoteCard event={parent} inThread />
      </div>
    </>
  );
}

export function Thread() {
  const { id = "" } = useParams();
  const decoded = useMemo(() => decodeAny(id), [id]);
  const pointer = decoded.type === "event" ? decoded.pointer : undefined;
  const event = use$(() => (pointer ? eventStore.event(pointer) : undefined), [pointer?.id]);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 9000);
    return () => clearTimeout(t);
  }, [id]);

  if (decoded.type === "address") return <Navigate to={"/a/" + id} replace />;
  if (decoded.type === "profile") return <Navigate to={"/p/" + id} replace />;
  if (event && isAddressable(event.kind)) {
    const d = event.tags.find((t) => t[0] === "d")?.[1] ?? "";
    return <Navigate to={"/a/" + naddrEncode({ kind: event.kind, pubkey: event.pubkey, identifier: d })} replace />;
  }
  return (
    <Screen
      back
      title="Note"
      actions={
        event && (
          <button type="button" className="iconbtn" aria-label="More options" onClick={() => openNoteMenu(event)}>
            <Icon name="more" />
          </button>
        )
      }
      footer={event && <ReplyBar event={event} />}
    >
      {!pointer ? (
        <Empty title="Can't open this">That link doesn't point to a note.</Empty>
      ) : !event ? (
        timedOut ? (
          <Empty title="Note not found">None of the servers Dusk asked have this note. It may have been deleted.</Empty>
        ) : (
          <FeedSkeleton count={1} label="Loading note" />
        )
      ) : (
        <ThreadBody event={event} />
      )}
    </Screen>
  );
}

function ThreadBody({ event }: { event: NostrEvent }) {
  const wot = useWot();
  const me = useActivePubkey();
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [inbox, outbox] = await Promise.all([inboxesOf(event.pubkey, 1500), outboxesOf(event.pubkey, 1500)]);
      const relays = uniqRelays(inbox, outbox, readRelays$.value, DEFAULT_RELAYS).slice(0, 10);
      await requestAll(relays, [{ kinds: [1, 1111], "#e": [event.id], limit: 500 }], 6000);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [event]);

  const all = use$(() => eventStore.timeline({ kinds: [1, 1111], "#e": [event.id] }), [event.id]);
  const replies = useMemo(
    () =>
      (all ?? [])
        .filter((r) => {
          if (r.kind === 1111) return r.tags.some((t) => t[0] === "e" && t[1] === event.id);
          const p = parentPointer(r);
          return p?.id === event.id;
        })
        .sort((a, b) => a.created_at - b.created_at),
    [all, event.id],
  );
  const trusted = wot ? replies.filter((r) => wot.has(r.pubkey) || r.pubkey === me) : replies;
  const others = wot ? replies.filter((r) => !wot.has(r.pubkey) && r.pubkey !== me) : [];
  const shown = showAll ? replies : trusted;

  return (
    <>
      <Ancestors event={event} />
      <NoteCard event={event} focus inThread />
      {shown.length > 0 && <div className="px-4 pt-5 pb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">{plural(replies.length, "reply", "replies")}</div>}
      <div className="[&>*+*]:border-t [&>*+*]:border-line">
        {shown.map((r) => (
          <NoteCard key={r.id} event={r} inThread />
        ))}
      </div>
      {!showAll && others.length > 0 && (
        <div className="px-4 py-4">
          <button type="button" className="btn btn-secondary w-full" onClick={() => setShowAll(true)}>
            Show {plural(others.length, "reply", "replies")} from outside your network
          </button>
        </div>
      )}
      {loading && <FeedSkeleton count={2} label="Loading replies" />}
      {!loading && !replies.length && <Endcap>No replies yet</Endcap>}
    </>
  );
}

function ReplyBar({ event }: { event: NostrEvent }) {
  const me = useActivePubkey();
  return (
    <div className="flex-none border-t border-line bg-bg px-4 pt-2 pb-[calc(8px+var(--safe-b))]">
      <button type="button" className="mx-auto flex min-h-11 w-full max-w-[600px] items-center gap-3 rounded-full border border-line bg-surface px-3 text-left text-[15px] text-subtle" onClick={() => requireSignIn() && openCompose({ replyTo: event })}>
        {me ? <Avatar pubkey={me} size="sm" /> : <Icon name="reply" />}
        Reply to {displayName(event.pubkey).split(" ")[0]}…
      </button>
    </div>
  );
}
