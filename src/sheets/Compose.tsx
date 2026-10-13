import { useEffect, useMemo, useRef, useState } from "react";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { NoteFactory, CommentFactory, PollFactory } from "applesauce-common/factories";
import { nprofileEncode } from "nostr-tools/nip19";
import { publish } from "../nostr/publish";
import { readRelays$, now } from "../nostr/core";
import { uploadFile, imetaTag, mediaServers, type Uploaded } from "../nostr/upload";
import { searchLocalProfiles, recentTags } from "../nostr/search";
import { hintFor } from "../nostr/relays";
import { useActivePubkey, getActivePubkey } from "../state/accounts";
import { useSettings } from "../state/settings";
import { openSheet, closeSheet, toast, errorToast } from "../state/ui";
import { allTimelines } from "../nostr/timeline";
import { eventCode } from "../lib/links";
import { hostOf } from "../lib/format";
import { lsGet, lsSet } from "../lib/kv";
import { Icon } from "../ui/Icon";
import { Avatar, Name } from "../ui/primitives";
import { NoteCard } from "../note/NoteCard";
import { nameOf, useProfile, displayName } from "../nostr/profile";

export type Draft = { id: string; text: string; replyTo?: NostrEvent; quote?: NostrEvent; t: number };

export function getDrafts(): Draft[] {
  const me = getActivePubkey();
  return me ? lsGet<Draft[]>("drafts:" + me, []) : [];
}
function saveDraft(d: Draft) {
  const me = getActivePubkey();
  if (!me) return;
  const all = getDrafts().filter((x) => x.id !== d.id);
  lsSet("drafts:" + me, d.text.trim() ? [d, ...all].slice(0, 30) : all);
}
export function deleteDraft(id: string) {
  const me = getActivePubkey();
  if (me) lsSet("drafts:" + me, getDrafts().filter((x) => x.id !== id));
}

export function openCompose(o: { replyTo?: NostrEvent; quote?: NostrEvent; text?: string; draft?: Draft }) {
  openSheet(<Compose {...o} />, { label: o.replyTo ? "Reply" : "New note", wide: true });
}

type Attachment = { id: string; file: File; preview: string; progress: number; uploaded?: Uploaded; error?: string; alt: string };

function MentionChip({ pubkey, onPick }: { pubkey: string; onPick: (pk: string, name: string) => void }) {
  const p = useProfile(pubkey);
  return (
    <button type="button" className="flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left hover:bg-wash" onMouseDown={(e) => (e.preventDefault(), onPick(pubkey, nameOf(p, pubkey)))}>
      <Avatar pubkey={pubkey} size="sm" />
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{nameOf(p, pubkey)}</span>
      <span className="truncate text-[13px] text-muted">{p?.nip05}</span>
    </button>
  );
}

function Compose({ replyTo, quote, text: initial, draft }: { replyTo?: NostrEvent; quote?: NostrEvent; text?: string; draft?: Draft }) {
  const me = useActivePubkey();
  const settings = useSettings();
  const [text, setText] = useState(draft?.text ?? initial ?? "");
  const [mentions, setMentions] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Attachment[]>([]);
  const [cw, setCw] = useState<string | null>(null);
  const [poll, setPoll] = useState<{ options: string[]; multi: boolean; days: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ac, setAc] = useState<{ type: "@" | "#"; q: string; start: number } | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftId = useRef(draft?.id ?? Math.random().toString(36).slice(2));
  const target = replyTo ?? draft?.replyTo;
  const quoted = quote ?? draft?.quote;
  const server = mediaServers()[0];

  useEffect(() => {
    const t = setTimeout(() => saveDraft({ id: draftId.current, text, replyTo: target, quote: quoted, t: now() }), 600);
    return () => clearTimeout(t);
  }, [text, target, quoted]);

  const suggestions = useMemo(() => {
    if (!ac) return [];
    return ac.type === "@" ? searchLocalProfiles(ac.q, 6) : recentTags(ac.q, 6);
  }, [ac]);

  const onInput = (v: string) => {
    setText(v);
    const el = ta.current;
    if (!el) return;
    const pos = el.selectionStart;
    const before = v.slice(0, pos);
    const m = /(^|\s)([@#])([\p{L}\p{N}_.-]{1,30})$/u.exec(before);
    setAc(m ? { type: m[2] as "@" | "#", q: m[3], start: pos - m[3].length - 1 } : null);
  };

  const pick = (value: string, label?: string) => {
    if (!ac) return;
    const el = ta.current!;
    const end = el.selectionStart;
    const insert = ac.type === "@" ? "@" + label + " " : "#" + value + " ";
    const next = text.slice(0, ac.start) + insert + text.slice(end);
    if (ac.type === "@" && label) setMentions((m) => ({ ...m, ["@" + label]: value }));
    setText(next);
    setAc(null);
    requestAnimationFrame(() => {
      el.focus();
      const p = ac.start + insert.length;
      el.setSelectionRange(p, p);
    });
  };

  const addFiles = (list: FileList | File[]) => {
    const arr = [...list].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/")).slice(0, 8 - files.length);
    const next = arr.map((file) => ({ id: Math.random().toString(36).slice(2), file, preview: URL.createObjectURL(file), progress: 0, alt: "" }));
    setFiles((f) => [...f, ...next]);
    for (const a of next)
      uploadFile(a.file, (p) => setFiles((fs) => fs.map((x) => (x.id === a.id ? { ...x, progress: p } : x))))
        .then((u) => setFiles((fs) => fs.map((x) => (x.id === a.id ? { ...x, uploaded: u, progress: 1 } : x))))
        .catch((e) => setFiles((fs) => fs.map((x) => (x.id === a.id ? { ...x, error: (e as Error).message } : x))));
  };

  const uploading = files.some((f) => !f.uploaded && !f.error);
  const pollValid = !poll || poll.options.filter((o) => o.trim()).length >= 2;
  const canPost = !busy && !uploading && (text.trim() || files.some((f) => f.uploaded)) && pollValid && !!me;

  const post = async () => {
    if (!canPost) return;
    const missingAlt = files.some((f) => f.uploaded && f.file.type.startsWith("image/") && !f.alt.trim());
    if (settings.altReminder && missingAlt && !confirm("Some photos have no description. Post anyway?")) return;
    setBusy(true);
    try {
      let content = text;
      for (const [label, pk] of Object.entries(mentions)) {
        const h = hintFor(pk);
        content = content.split(label).join("nostr:" + nprofileEncode({ pubkey: pk, relays: h ? [h] : [] }));
      }
      const media = files.filter((f) => f.uploaded).map((f) => ({ ...f.uploaded!, alt: f.alt.trim() || undefined }));
      if (media.length) content = (content.trim() + "\n\n" + media.map((m) => m.url).join("\n")).trim();
      if (quoted) content = (content.trim() + "\n\nnostr:" + eventCode(quoted)).trim();
      const opts = cw != null ? { contentWarning: cw || true } : {};
      let template;
      if (poll) {
        const options = poll.options.map((l) => l.trim()).filter(Boolean).map((label, i) => ({ id: "o" + i, label }));
        let f = PollFactory.create(content, options, opts).pollType(poll.multi ? "multiplechoice" : "singlechoice").relays(readRelays$.value.slice(0, 3));
        if (poll.days) f = f.endsAt(now() + poll.days * 86400);
        template = await f;
      } else if (target && target.kind !== 1) template = await CommentFactory.create(target, content, opts);
      else if (target) template = await NoteFactory.reply(target, content, opts);
      else template = await NoteFactory.create(content, opts);
      const tags = [...template.tags];
      for (const m of media) tags.push(imetaTag(m));
      if (quoted) {
        tags.push(["q", quoted.id, hintFor(quoted.pubkey) ?? "", quoted.pubkey]);
        if (!tags.some((t) => t[0] === "p" && t[1] === quoted.pubkey)) tags.push(["p", quoted.pubkey]);
      }
      const { event } = await publish({ ...template, tags });
      deleteDraft(draftId.current);
      if (!target) for (const t of allTimelines()) t.prepend(event);
      closeSheet();
      toast(target ? "Reply sent" : "Posted");
    } catch (e) {
      errorToast(e, "Couldn't post");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      {target && (
        <div className="-mx-5 max-h-48 overflow-hidden border-b border-line opacity-90 [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
          <NoteCard event={target} preview />
        </div>
      )}
      <div className="flex gap-3">
        {me && <Avatar pubkey={me} />}
        <div className="relative min-w-0 flex-1">
          {poll && <div className="mb-1 text-[13px] text-muted">Your question</div>}
          <textarea
            ref={ta}
            autoFocus
            rows={target ? 3 : 5}
            className="w-full resize-none bg-transparent text-[17px] leading-[26px] outline-none placeholder:text-subtle"
            placeholder={poll ? "Ask something" : target ? "Write your reply" : "What's on your mind?"}
            value={text}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                post();
              }
              if (ac && suggestions.length && (e.key === "Tab" || e.key === "Enter")) {
                e.preventDefault();
                const first = suggestions[0];
                if (ac.type === "@") pick(first, searchLabel(first));
                else pick(first);
              }
              if (e.key === "Escape" && ac) {
                e.stopPropagation();
                setAc(null);
              }
            }}
            onPaste={(e) => {
              if (e.clipboardData.files.length) {
                e.preventDefault();
                addFiles(e.clipboardData.files);
              }
            }}
            aria-label={target ? "Reply" : "Note"}
          />
          {ac && suggestions.length > 0 && (
            <div className="mt-1 rounded-[14px] border border-line bg-surface p-1">
              {ac.type === "@"
                ? suggestions.map((pk) => <MentionChip key={pk} pubkey={pk} onPick={(p, n) => pick(p, n)} />)
                : suggestions.map((t) => (
                    <button key={t} type="button" className="block w-full rounded-[10px] px-3 py-2 text-left text-[15px] hover:bg-wash" onMouseDown={(e) => (e.preventDefault(), pick(t))}>
                      #{t}
                    </button>
                  ))}
            </div>
          )}
        </div>
      </div>

      {target && (
        <p className="caption">
          Replying to <Name pubkey={target.pubkey} className="font-medium text-ink" />
        </p>
      )}

      {poll && (
        <div className="grid gap-2 rounded-[14px] border border-line p-3">
          {poll.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className="field min-h-11 py-2" placeholder={`Option ${i + 1}`} value={o} maxLength={80} onChange={(e) => setPoll({ ...poll, options: poll.options.map((x, j) => (j === i ? e.target.value : x)) })} />
              {poll.options.length > 2 && (
                <button type="button" className="iconbtn" aria-label="Remove option" onClick={() => setPoll({ ...poll, options: poll.options.filter((_, j) => j !== i) })}>
                  <Icon name="close" />
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            {poll.options.length < 10 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPoll({ ...poll, options: [...poll.options, ""] })}>
                <Icon name="plus" size={18} />
                Add option
              </button>
            )}
            <label className="ml-auto flex items-center gap-2 text-[14px]">
              <input type="checkbox" checked={poll.multi} onChange={(e) => setPoll({ ...poll, multi: e.target.checked })} />
              Several answers
            </label>
            <select className="rounded-lg border border-line bg-raised px-2 py-1 text-[14px]" value={poll.days} onChange={(e) => setPoll({ ...poll, days: Number(e.target.value) })} aria-label="Poll length">
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>1 week</option>
              <option value={0}>No end</option>
            </select>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="grid gap-2">
          {files.map((f) => (
            <div key={f.id} className="flex gap-3 rounded-[14px] border border-line p-2">
              <div className="relative size-20 flex-none overflow-hidden rounded-[10px] bg-surface">
                {f.file.type.startsWith("video/") ? <video src={f.preview} className="size-full object-cover" /> : <img src={f.preview} alt="" className="size-full object-cover" />}
                {!f.uploaded && !f.error && (
                  <span className="absolute inset-x-1 bottom-1 h-1 overflow-hidden rounded-full bg-black/40">
                    <span className="block h-full bg-accent transition-[width]" style={{ width: Math.round(f.progress * 100) + "%" }} />
                  </span>
                )}
              </div>
              <div className="grid min-w-0 flex-1 content-start gap-1">
                {f.error ? (
                  <span className="text-[14px] text-clay-ink">{f.error}</span>
                ) : (
                  <textarea rows={2} className="w-full resize-none rounded-[8px] border border-line bg-transparent px-2 py-1 text-[14px] outline-none" placeholder="Describe this for people who can't see it" value={f.alt} onChange={(e) => setFiles((fs) => fs.map((x) => (x.id === f.id ? { ...x, alt: e.target.value } : x)))} />
                )}
                <span className="caption">{f.uploaded ? `Uploaded to ${hostOf(server)}` : f.error ? "" : `Uploading… ${Math.round(f.progress * 100)}%`}</span>
              </div>
              <button type="button" className="iconbtn self-start" aria-label="Remove" onClick={() => setFiles((fs) => fs.filter((x) => x.id !== f.id))}>
                <Icon name="close" />
              </button>
            </div>
          ))}
        </div>
      )}

      {quoted && (
        <div className="-mx-1 max-h-56 overflow-hidden rounded-[14px] border border-line [mask-image:linear-gradient(to_bottom,black_75%,transparent)]">
          <NoteCard event={quoted} preview />
        </div>
      )}

      {cw != null && <input className="field min-h-11 py-2" placeholder="Content warning (optional reason)" value={cw} onChange={(e) => setCw(e.target.value)} />}

      <div className="sticky -bottom-2 z-10 -mx-5 flex items-center gap-1 border-t border-line bg-raised px-5 pt-2 pb-2">
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
        <button type="button" className="iconbtn" aria-label="Add photos" disabled={files.length >= 8 || !!poll} onClick={() => fileRef.current?.click()}>
          <Icon name="image" />
        </button>
        {!target && (
          <button type="button" className={`iconbtn ${poll ? "text-accent-ink" : ""}`} aria-pressed={!!poll} aria-label="Poll" disabled={files.length > 0} onClick={() => setPoll(poll ? null : { options: ["", ""], multi: false, days: 1 })}>
            <Icon name="poll" />
          </button>
        )}
        <button type="button" className={`iconbtn ${cw != null ? "text-butter-ink" : ""}`} aria-pressed={cw != null} aria-label="Content warning" onClick={() => setCw(cw == null ? "" : null)}>
          <Icon name="warn" />
        </button>
        <button type="button" className="iconbtn" aria-label="Mention someone" onClick={() => onInput(text + (text && !text.endsWith(" ") ? " @" : "@"))}>
          <Icon name="at" />
        </button>
        <span className="ml-auto pr-2 text-[13px] text-subtle tabular-nums">{text.length > 280 ? text.length : ""}</span>
        <button type="button" className="btn btn-primary" disabled={!canPost} onClick={post}>
          {busy ? "Sending…" : target ? "Reply" : "Post"}
        </button>
      </div>
      {!me && <p className="caption">Sign in to post.</p>}
    </div>
  );
}

function searchLabel(pk: string) {
  return displayName(pk);
}
