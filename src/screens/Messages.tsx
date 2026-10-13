import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useConversations, useDMs, markConversationRead, markConversationUnread, hideConversation, acceptConversation, sendDM, decryptNow, setAutoDecrypt, useDMReactions, type DM } from "../nostr/dms";
import { useFollowing, setMute } from "../nostr/lists";
import { useActivePubkey, useActiveAccount } from "../state/accounts";
import { uploadEncrypted, decryptFile } from "../nostr/upload";
import { searchLocalProfiles } from "../nostr/search";
import { displayName, useProfile, nameOf } from "../nostr/profile";
import { profilePath, pubkeyFrom } from "../lib/links";
import { ago, fullDate } from "../lib/format";
import { openSheet, closeSheet, toast, errorToast, openLightbox } from "../state/ui";
import { Screen, Chips } from "../ui/Screen";
import { Empty, Endcap, Avatar, Name } from "../ui/primitives";
import { SwipeRow } from "../ui/SwipeRow";
import { Icon } from "../ui/Icon";
import { RichText } from "../note/Content";
import { openOnboarding } from "./Onboarding";

function ConvAvatar({ with: w }: { with: string[] }) {
  if (w.length === 1) return <Avatar pubkey={w[0]} />;
  return (
    <span className="relative size-10 flex-none">
      <Avatar pubkey={w[0]} size="sm" className="absolute top-0 left-0" />
      <Avatar pubkey={w[1]} size="sm" className="absolute right-0 bottom-0 shadow-[0_0_0_2px_var(--surface)]" />
    </span>
  );
}

function convName(w: string[]) {
  return w.map((p) => displayName(p).split(" ")[0]).join(", ");
}

export function Messages() {
  const me = useActivePubkey();
  const account = useActiveAccount();
  const follows = useFollowing(me);
  const convs = useConversations(follows);
  const queued = useDMs((s) => s.queued.length);
  const decrypting = useDMs((s) => s.decrypting);
  const auto = useDMs((s) => s.autoDecrypt);
  const [tab, setTab] = useState<"chats" | "requests">("chats");
  const nav = useNavigate();
  if (!me)
    return (
      <Screen title="Messages">
        <Empty title="Sign in to message people" action={<button type="button" className="btn btn-primary" onClick={() => openOnboarding("signin")}>Sign in</button>}>
          Private messages are end-to-end encrypted. Only you and the other person can read them.
        </Empty>
      </Screen>
    );
  const chats = convs.filter((c) => !c.isRequest);
  const requests = convs.filter((c) => c.isRequest);
  const list = tab === "chats" ? chats : requests;
  const needsConsent = account?.type === "extension" && !auto && queued > 0;
  return (
    <Screen
      title="Messages"
      actions={
        <button type="button" className="iconbtn" aria-label="New message" onClick={() => openSheet(<NewMessage onPick={(pk) => (closeSheet(), nav("/messages/" + pk))} />, { label: "New message" })}>
          <Icon name="edit" />
        </button>
      }
      sub={
        <Chips label="Conversations">
          <button type="button" role="tab" className="chip" aria-selected={tab === "chats"} onClick={() => setTab("chats")}>
            Chats
          </button>
          <button type="button" role="tab" className="chip" aria-selected={tab === "requests"} onClick={() => setTab("requests")}>
            Requests{requests.length ? ` · ${requests.length}` : ""}
          </button>
        </Chips>
      }
    >
      {needsConsent && (
        <div className="m-4 grid gap-2 rounded-[14px] border border-line bg-surface p-4">
          <b className="text-[15px]">{queued} encrypted {queued === 1 ? "message" : "messages"} waiting</b>
          <p className="text-[14px] text-muted">Your extension will ask before decrypting each one, unless you allow it to always decrypt for Dusk.</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setAutoDecrypt(true)}>
              Decrypt now
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={decryptNow}>
              Just once
            </button>
          </div>
        </div>
      )}
      {decrypting && <p className="px-4 py-2 text-[13px] text-muted">Decrypting {queued} more…</p>}
      {list.length ? (
        <div className="[&>*+*]:border-t [&>*+*]:border-line">
          {list.map((c) => (
            <SwipeRow
              key={c.id}
              start={{ label: c.unread ? "Mark read" : "Mark unread", icon: "check", tone: "lilac", run: () => (c.unread ? markConversationRead(c.id) : markConversationUnread(c.id)) }}
              end={{ label: "Hide", icon: "eyeoff", tone: "clay", run: () => (hideConversation(c.id), toast("Conversation hidden", { undo: () => hideConversation(c.id, false) })) }}
            >
              <Link to={"/messages/" + c.id} className="grid grid-cols-[40px_1fr_auto] items-center gap-3 px-4 py-3">
                <ConvAvatar with={c.with} />
                <span className="min-w-0">
                  <span className={`block truncate text-[15px] ${c.unread ? "font-semibold" : "font-medium"}`}>{convName(c.with)}</span>
                  <span className={`block truncate text-[14px] ${c.unread ? "text-ink" : "text-muted"}`}>
                    {c.last.pubkey === me ? "You: " : ""}
                    {c.last.kind === 15 ? "Photo" : c.last.content}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1 text-[13px] text-muted tabular-nums">
                  {ago(c.last.created_at)}
                  {c.unread > 0 && <span className="size-2 rounded-full bg-lilac-ink" aria-label={`${c.unread} unread`} />}
                </span>
              </Link>
            </SwipeRow>
          ))}
        </div>
      ) : (
        <Empty title={tab === "chats" ? "No messages yet" : "No requests"} action={tab === "chats" && <button type="button" className="btn btn-primary" onClick={() => openSheet(<NewMessage onPick={(pk) => (closeSheet(), nav("/messages/" + pk))} />, { label: "New message" })}>New message</button>}>
          {tab === "chats" ? "Start a private conversation with anyone." : "Messages from people you don't follow wait here until you reply."}
        </Empty>
      )}
      {list.length > 0 && <Endcap>Messages are end-to-end encrypted (NIP-17). Only the people in a conversation can read them.</Endcap>}
    </Screen>
  );
}

function NewMessage({ onPick }: { onPick: (pk: string) => void }) {
  const [q, setQ] = useState("");
  const direct = pubkeyFrom(q.trim());
  const results = useMemo(() => (q.trim().length > 1 ? searchLocalProfiles(q, 8) : searchLocalProfiles("", 0)), [q]);
  return (
    <div className="grid gap-3">
      <h2 className="text-xl font-semibold">New message</h2>
      <input className="field" autoFocus placeholder="Search people or paste npub" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="-mx-5">
        {direct && <PickRow pubkey={direct} onPick={onPick} />}
        {results.map((pk) => (
          <PickRow key={pk} pubkey={pk} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function PickRow({ pubkey, onPick }: { pubkey: string; onPick: (pk: string) => void }) {
  const p = useProfile(pubkey);
  return (
    <button type="button" className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-wash" onClick={() => onPick(pubkey)}>
      <Avatar pubkey={pubkey} />
      <span className="min-w-0">
        <b className="block truncate text-[15px]">{nameOf(p, pubkey)}</b>
        <span className="block truncate text-[13px] text-muted">{p?.nip05}</span>
      </span>
    </button>
  );
}

function FileBubble({ m }: { m: DM }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const type = m.tags.find((t) => t[0] === "file-type")?.[1] ?? "";
  useEffect(() => {
    const key = m.tags.find((t) => t[0] === "decryption-key")?.[1];
    const nonce = m.tags.find((t) => t[0] === "decryption-nonce")?.[1];
    if (!key || !nonce) return setUrl(m.content);
    let u: string | null = null;
    decryptFile(m.content, key, nonce, type)
      .then((x) => setUrl((u = x)))
      .catch(() => setErr(true));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [m, type]);
  if (err) return <span className="text-[14px] text-muted">Couldn't open this file</span>;
  if (!url) return <span className="spinner" />;
  if (type.startsWith("image/")) return <img src={url} alt="" className="max-h-72 cursor-zoom-in rounded-[12px]" onClick={(e) => openLightbox([url], 0, undefined, e.currentTarget)} />;
  if (type.startsWith("video/")) return <video src={url} controls className="max-h-72 rounded-[12px]" />;
  return (
    <a href={url} download className="underline">
      Download file
    </a>
  );
}

export function Chat() {
  const { id = "" } = useParams();
  const me = useActivePubkey();
  const others = useMemo(() => id.split(",").filter((x) => /^[0-9a-f]{64}$/.test(x)), [id]);
  const reactions = useDMReactions();
  const follows = useFollowing(me);
  const convs = useConversations(follows);
  const conv = convs.find((c) => c.id === [...others].sort().join(","));
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const msgs = useMemo(() => conv?.messages ?? [], [conv]);

  useEffect(() => {
    if (conv) markConversationRead(conv.id);
  }, [conv?.last.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  if (!me) return <Messages />;
  if (!others.length) return <Empty title="Can't open this conversation" />;

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    setSending(true);
    try {
      await sendDM(others, t);
      if (conv?.isRequest) acceptConversation(conv.id);
    } catch (e) {
      errorToast(e, "Not delivered");
    } finally {
      setSending(false);
    }
  };
  const sendFile = async (f?: File) => {
    if (!f) return;
    setUploading(true);
    try {
      const up = await uploadEncrypted(f);
      await sendDM(others, up.url, { kind: 15, tags: up.tags });
    } catch (e) {
      errorToast(e, "Couldn't send the photo");
    } finally {
      setUploading(false);
    }
  };
  const reactTo = async (m: DM, emoji: string) => {
    try {
      await sendDM(others, emoji, { kind: 7, tags: [["e", m.id], ["k", String(m.kind)]] });
    } catch (e) {
      errorToast(e, "Couldn't react");
    }
  };

  const title = others.length === 1 ? <Name pubkey={others[0]} /> : convName(others);
  return (
    <Screen
      back
      chat
      title={title}
      scrollKey={"chat:" + id}
      actions={
        others.length === 1 && (
          <Link to={profilePath(others[0])} className="iconbtn" aria-label="View profile">
            <Icon name="user" />
          </Link>
        )
      }
      footer={
        <form
          className="flex flex-none items-end gap-2 border-t border-line bg-bg px-3 pt-2 pb-[calc(8px+var(--safe-b))]"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => sendFile(e.target.files?.[0])} />
          <button type="button" className="iconbtn" aria-label="Send a photo" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <span className="spinner size-5" /> : <Icon name="image" />}
          </button>
          <textarea
            rows={1}
            className="max-h-36 min-h-11 flex-1 resize-none rounded-[22px] border border-line bg-surface px-4 py-2.5 text-[16px] leading-6 outline-none"
            placeholder={`Message ${others.length === 1 ? displayName(others[0]).split(" ")[0] : "the group"}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            aria-label="Message"
          />
          <button type="submit" className="grid size-11 flex-none place-items-center rounded-full bg-accent text-on-accent disabled:opacity-40" aria-label="Send" disabled={!text.trim() || sending}>
            <Icon name="send" />
          </button>
        </form>
      }
    >
      <div className="flex flex-col gap-1 px-4 py-4">
        <div className="mx-auto mb-4 flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-[13px] text-muted">
          <Icon name="lock" size={16} />
          Private. Only you and {others.length === 1 ? displayName(others[0]).split(" ")[0] : "these people"} can read these.
        </div>
        {conv?.isRequest && (
          <div className="mb-3 grid gap-2 rounded-[14px] border border-line bg-surface p-3 text-[14px]">
            <span>You don't follow {convName(others)}. Reply to move this to your chats.</span>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => acceptConversation(conv.id)}>
                Accept
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => (others.forEach((o) => setMute("user", o, true)), hideConversation(conv.id), history.back())}>
                Block
              </button>
            </div>
          </div>
        )}
        {msgs.map((m, i) => {
          const mine = m.pubkey === me;
          const next = msgs[i + 1];
          const showTime = !next || next.pubkey !== m.pubkey || next.created_at - m.created_at > 600;
          const showAuthor = !mine && others.length > 1 && (i === 0 || msgs[i - 1].pubkey !== m.pubkey);
          const rs = reactions.get(m.id) ?? [];
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              {showAuthor && <span className="mt-2 mb-0.5 px-3 text-[12px] text-muted">{displayName(m.pubkey)}</span>}
              <div
                className={`max-w-[80%] rounded-[20px] px-4 py-2.5 text-[15px] leading-[21px] ${mine ? "rounded-br-[6px] bg-accent text-on-accent [&_a]:text-on-accent [&_a]:underline" : "rounded-bl-[6px] bg-surface"} ${m.failed ? "opacity-60" : ""}`}
                onDoubleClick={() => !mine && reactTo(m, "❤️")}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openSheet(<BubbleMenu onReact={(em) => (closeSheet(), reactTo(m, em))} m={m} />, { label: "Message" });
                }}
                title={fullDate(m.created_at)}
              >
                {m.kind === 15 ? <FileBubble m={m} /> : <RichText event={{ ...m, sig: "" } as never} />}
              </div>
              {rs.length > 0 && <span className="-mt-1.5 rounded-full border border-line bg-raised px-1.5 text-[13px]">{[...new Set(rs.map((r) => r.content))].join(" ")}</span>}
              {showTime && <span className="mt-0.5 mb-2 px-2 text-[12px] text-subtle">{m.pending ? "Sending…" : m.failed ? "Not delivered" : ago(m.created_at)}</span>}
            </div>
          );
        })}
        {!msgs.length && <p className="py-8 text-center text-[14px] text-muted">Say hello. Messages are sent with NIP-17 encryption.</p>}
        <div ref={endRef} />
      </div>
    </Screen>
  );
}

function BubbleMenu({ m, onReact }: { m: DM; onReact: (e: string) => void }) {
  return (
    <div className="grid gap-3">
      <div className="flex justify-between">
        {["❤️", "😂", "👍", "🔥", "😮", "🙏"].map((e) => (
          <button key={e} type="button" className="grid size-12 place-items-center rounded-full text-2xl hover:bg-wash" onClick={() => onReact(e)}>
            {e}
          </button>
        ))}
      </div>
      {m.kind === 14 && (
        <button type="button" className="btn btn-secondary" onClick={() => (navigator.clipboard?.writeText(m.content), closeSheet(), toast("Copied"))}>
          Copy text
        </button>
      )}
    </div>
  );
}
