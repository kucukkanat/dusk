import { useState } from "react";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { getSeenRelays } from "applesauce-core/helpers/relays";
import { openSheet, closeSheet, replaceSheet, copyText, toast, errorToast } from "../state/ui";
import { useActivePubkey } from "../state/accounts";
import { setBookmark, setMute, useMyBookmarks, useMyMutes } from "../nostr/lists";
import { deleteEvents, report, requireSignIn } from "../note/actions";
import { eventCode, eventPath, shareUrl } from "../lib/links";
import { displayName } from "../nostr/profile";
import { fullDate } from "../lib/format";
import { Icon, type IconName } from "../ui/Icon";

export function openNoteMenu(event: NostrEvent) {
  openSheet(<NoteMenu event={event} />, { label: "Note options" });
}

function Item({ icon, label, onClick, danger }: { icon: IconName; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <li>
      <button type="button" className={`flex min-h-[52px] w-full items-center gap-3 rounded-[8px] px-2 text-left text-[15px] font-medium hover:bg-wash ${danger ? "text-clay-ink" : ""}`} onClick={onClick}>
        <Icon name={icon} className={danger ? "" : "text-muted"} />
        {label}
      </button>
    </li>
  );
}

function NoteMenu({ event }: { event: NostrEvent }) {
  const me = useActivePubkey();
  const bookmarks = useMyBookmarks();
  const mutes = useMyMutes();
  const mine = event.pubkey === me;
  const bookmarked = bookmarks.has(event.id);
  const threadRoot = event.tags.find((t) => t[0] === "e" && t[3] === "root")?.[1] ?? event.id;
  const threadMuted = mutes.threads.has(threadRoot);
  const name = displayName(event.pubkey);
  const link = shareUrl(eventPath(event));
  const act = (fn: () => unknown) => () => {
    closeSheet();
    fn();
  };
  return (
    <ul className="grid gap-1">
      {typeof navigator.share === "function" && <Item icon="share" label="Share" onClick={act(() => navigator.share({ url: link }).catch(() => {}))} />}
      <Item icon="link" label="Copy link" onClick={act(() => copyText(link, "Copied link"))} />
      {event.content && <Item icon="copy" label="Copy text" onClick={act(() => copyText(event.content, "Copied text"))} />}
      <Item icon="bookmark" label={bookmarked ? "Remove bookmark" : "Bookmark"} onClick={act(() => requireSignIn() && setBookmark(event, !bookmarked))} />
      <Item
        icon="eyeoff"
        label={threadMuted ? "Unmute this thread" : "Mute this thread"}
        onClick={act(() => requireSignIn() && setMute("thread", threadRoot, !threadMuted).then(() => toast(threadMuted ? "Thread unmuted" : "Thread muted. You won't see replies to it.")))}
      />
      {!mine && (
        <Item
          icon="mute"
          label={`Mute ${name}`}
          onClick={act(() => requireSignIn() && setMute("user", event.pubkey, true).then(() => toast(`Muted ${name}`, { undo: () => setMute("user", event.pubkey, false) })))}
        />
      )}
      {!mine && <Item icon="flag" label="Report" danger onClick={() => requireSignIn() && replaceSheet(<ReportSheet event={event} />)} />}
      <Item icon="info" label="Details" onClick={() => replaceSheet(<Details event={event} />)} />
      {mine && <Item icon="trash" label="Delete" danger onClick={() => replaceSheet(<ConfirmDelete event={event} />)} />}
    </ul>
  );
}

function ConfirmDelete({ event }: { event: NostrEvent }) {
  return (
    <div className="grid gap-3">
      <h2 className="text-xl font-semibold">Delete this note?</h2>
      <p className="text-[15px] text-muted">Dusk asks every server to remove it. Most will, but copies may stay on servers that ignore deletion requests or on other people's devices.</p>
      <button
        type="button"
        className="btn btn-danger btn-lg"
        onClick={() => {
          closeSheet();
          deleteEvents([event])
            .then(() => toast("Deleted"))
            .catch((e) => errorToast(e, "Couldn't delete"));
        }}
      >
        Delete
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => closeSheet()}>
        Cancel
      </button>
    </div>
  );
}

const REPORT_TYPES: [string, string][] = [
  ["spam", "Spam"],
  ["impersonation", "Pretending to be someone"],
  ["nudity", "Nudity or sexual content"],
  ["profanity", "Hateful or abusive"],
  ["illegal", "Illegal content"],
  ["malware", "Scam or malware"],
  ["other", "Something else"],
];

export function ReportSheet({ event, pubkey }: { event?: NostrEvent; pubkey?: string }) {
  const [type, setType] = useState("spam");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const target = event?.pubkey ?? pubkey!;
  return (
    <div className="grid gap-3">
      <h2 className="text-xl font-semibold">{event ? "Report this note" : `Report ${displayName(target)}`}</h2>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {REPORT_TYPES.map(([k, l]) => (
          <button key={k} type="button" className="chip" role="radio" aria-checked={type === k} onClick={() => setType(k)}>
            {l}
          </button>
        ))}
      </div>
      <textarea className="field" rows={3} placeholder="Anything else? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <p className="caption">Reports are public on Nostr. Relays and clients use them to filter content.</p>
      <button
        type="button"
        className="btn btn-danger btn-lg"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await report(event ?? null, target, type, reason);
            closeSheet();
          } catch (e) {
            errorToast(e, "Couldn't send report");
          } finally {
            setBusy(false);
          }
        }}
      >
        Send report
      </button>
    </div>
  );
}

function Details({ event }: { event: NostrEvent }) {
  const seen = [...(getSeenRelays(event) ?? [])];
  const clean = { id: event.id, pubkey: event.pubkey, created_at: event.created_at, kind: event.kind, tags: event.tags, content: event.content, sig: event.sig };
  return (
    <div className="grid gap-3">
      <h2 className="text-xl font-semibold">Details</h2>
      <dl className="grid gap-2 text-[14px]">
        <div>
          <dt className="caption">Posted</dt>
          <dd>{fullDate(event.created_at)}</dd>
        </div>
        <div>
          <dt className="caption">Kind</dt>
          <dd>{event.kind}</dd>
        </div>
        {seen.length > 0 && (
          <div>
            <dt className="caption">Seen on</dt>
            <dd className="flex flex-wrap gap-x-2">
              {seen.map((r) => (
                <span key={r} className="key">
                  {r.replace("wss://", "")}
                </span>
              ))}
            </dd>
          </div>
        )}
        <div>
          <dt className="caption">Address</dt>
          <dd className="flex items-center gap-1">
            <span className="key min-w-0 flex-1 truncate">{eventCode(event)}</span>
            <button type="button" className="iconbtn" aria-label="Copy address" onClick={() => copyText(eventCode(event), "Copied")}>
              <Icon name="copy" />
            </button>
          </dd>
        </div>
      </dl>
      <pre className="key max-h-72 overflow-auto rounded-[10px] bg-surface p-3 whitespace-pre-wrap">{JSON.stringify(clean, null, 2)}</pre>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-secondary" onClick={() => copyText(JSON.stringify(clean), "Copied raw event")}>
          Copy raw
        </button>
        <a className="btn btn-secondary" href={"https://njump.me/" + eventCode(event)} target="_blank" rel="noreferrer">
          Open elsewhere
        </a>
      </div>
    </div>
  );
}
