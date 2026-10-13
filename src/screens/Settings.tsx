import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { use$ } from "applesauce-react/hooks";
import { getInboxes, getOutboxes } from "applesauce-core/helpers/mailboxes";
import { getBlossomServersFromList } from "applesauce-common/helpers/blossom";
import { useSettings, type SwipeAction } from "../state/settings";
import { useActivePubkey, useActiveAccount, useAccounts, lockAccount, getSigner, encryptKey } from "../state/accounts";
import { nsecEncode } from "nostr-tools/nip19";
import { hexToBytes } from "@noble/hashes/utils.js";
import { eventStore, normalizeRelay, uniqRelays, DEFAULT_RELAYS, clearCache, LOOKUP_RELAYS } from "../nostr/core";
import { ensureLatest } from "../nostr/actions";
import { publish } from "../nostr/publish";
import { useMyMutes, setMute } from "../nostr/lists";
import { useWallet, connectWallet, disconnectWallet, refreshBalance } from "../nostr/zaps";
import { mediaServers } from "../nostr/upload";
import { useProfile, nameOf, formatNip05 } from "../nostr/profile";
import { npub } from "../lib/links";
import { sats, hostOf, middle } from "../lib/format";
import { kvClear } from "../lib/kv";
import { copyText, toast, errorToast, openSheet } from "../state/ui";
import { Screen } from "../ui/Screen";
import { Group, Row, ToggleRow, ChipSet, Avatar, Field, Warn, StatusDot, Empty } from "../ui/primitives";
import { PersonRow } from "../ui/PersonRow";
import { Icon } from "../ui/Icon";
import { NoteCard, SWIPE_ACTIONS } from "../note/NoteCard";
import { openEditProfile } from "../sheets/EditProfile";
import { openShortcuts } from "./Shortcuts";
import { openOnboarding } from "./Onboarding";
import { SOURCES, openFeedAdd } from "./Home";

const TITLES: Record<string, string> = {
  root: "Settings",
  appearance: "Appearance",
  gestures: "Gestures",
  feeds: "Feeds",
  wallet: "Lightning wallet",
  notifications: "Notifications",
  muted: "Muted",
  safety: "Safety",
  account: "Keys and sign-in",
  servers: "Servers",
  inbox: "Message servers",
  media: "Media servers",
  accessibility: "Accessibility",
  advanced: "Advanced",
  vanish: "Request to vanish",
  about: "About Dusk",
};

export function Settings() {
  const { section = "root" } = useParams();
  const Body = SECTIONS[section] ?? Root;
  return (
    <Screen back title={TITLES[section] ?? "Settings"} scrollKey={"settings:" + section}>
      <Body />
      <div className="h-8" />
    </Screen>
  );
}

const SECTIONS: Record<string, () => React.ReactElement> = {
  root: Root,
  appearance: Appearance,
  gestures: Gestures,
  feeds: Feeds,
  wallet: Wallet,
  notifications: Notifications,
  muted: Muted,
  safety: Safety,
  account: Account,
  servers: Servers,
  inbox: InboxServers,
  media: MediaServers,
  accessibility: Accessibility,
  advanced: Advanced,
  vanish: Vanish,
  about: About,
};

function Root() {
  const me = useActivePubkey();
  const s = useSettings();
  const p = useProfile(me);
  const mutes = useMyMutes();
  const wallet = useWallet();
  const account = useActiveAccount();
  const accounts = useAccounts((x) => x.accounts);
  const relays = useMyRelays();
  return (
    <>
      {me ? (
        <Group>
          <Row icon={<Avatar pubkey={me} />} title={nameOf(p, me)} sub={p?.nip05 ? formatNip05(p.nip05) : middle(npub(me), 12, 6)} onClick={openEditProfile} right={<span className="text-[14px] text-muted">Edit</span>} />
        </Group>
      ) : (
        <Group>
          <Row icon="key" title="Sign in or create an account" sub="Browsing as a guest" onClick={() => openOnboarding("welcome")} />
        </Group>
      )}
      <Group label="Make it yours">
        <Row icon="palette" title="Appearance" sub="Theme, accent, density" to="/settings/appearance" />
        <Row icon="gesture" title="Gestures" sub={`Swipe right: ${SWIPE_ACTIONS[s.swipeStart].label} · Swipe left: ${SWIPE_ACTIONS[s.swipeEnd].label}`} to="/settings/gestures" />
        <Row icon="list" title="Feeds" sub={`${s.feeds.length} feeds`} to="/settings/feeds" />
        <Row icon="eye" title="Accessibility" sub="Text size, contrast, motion, data saver" to="/settings/accessibility" />
      </Group>
      <Group label="Zaps">
        <Row icon="zap" title="Lightning wallet" sub={wallet.uri ? (wallet.balance != null ? `${sats(wallet.balance)} sats` : "Connected") : "Not connected"} to="/settings/wallet" />
      </Group>
      <Group label="Quiet">
        <Row icon="bell" title="Notifications" sub="Mentions, messages and zaps" to="/settings/notifications" />
        <Row icon="mute" title="Muted" sub={`${mutes.pubkeys.size} people, ${mutes.words.size} words, ${mutes.hashtags.size} tags`} to="/settings/muted" />
        <Row icon="verified" title="Safety" sub="Web of trust, media from strangers" to="/settings/safety" />
      </Group>
      <Group label="Account">
        <Row icon="people" title="Identities" sub={`${accounts.length} on this device · switch or add one`} to="/identities" />
        {me && <Row icon="key" title="Keys and sign-in" sub={account ? { extension: "Browser extension", bunker: "Remote signer", key: "Key on this device" }[account.type] : ""} to="/settings/account" />}
        <Row icon="server" title="Servers" sub={`${relays.length} relays`} to="/settings/servers" />
        {me && <Row icon="message" title="Message servers" sub="Where private messages reach you" to="/settings/inbox" />}
        {me && <Row icon="image" title="Media servers" sub={hostOf(mediaServers()[0] ?? "")} to="/settings/media" />}
        <Row icon="bookmark" title="Bookmarks" to="/bookmarks" />
        <Row icon="list" title="Lists" sub="Follow sets and packs" to="/lists" />
        <Row icon="draft" title="Drafts" to="/drafts" />
      </Group>
      <Group label="More">
        <Row icon="settings" title="Advanced" sub="Cache, raw data" to="/settings/advanced" />
        <Row icon="info" title="About Dusk" to="/settings/about" />
      </Group>
    </>
  );
}

function Appearance() {
  const s = useSettings();
  const accents = ["mist", "peach", "rose", "sage", "lilac", "butter"] as const;
  return (
    <>
      <Group label="Theme">
        <ChipSet options={[["auto", "Match system"], ["night", "Night"], ["dawn", "Dawn"]]} value={s.theme} onChange={(v) => s.set({ theme: v })} label="Theme" />
      </Group>
      <Group label="Accent">
        <div className="flex gap-3 px-4 py-3" role="radiogroup" aria-label="Accent">
          {accents.map((a) => (
            <button key={a} type="button" role="radio" aria-checked={s.accent === a} aria-label={a} className={`grid size-11 place-items-center rounded-full text-on-accent ${s.accent === a ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`} style={{ background: `var(--${a})` }} onClick={() => s.set({ accent: a })}>
              {s.accent === a && <Icon name="check" />}
            </button>
          ))}
        </div>
      </Group>
      <Group label="Density">
        <ChipSet options={[["comfortable", "Comfortable"], ["compact", "Compact"]]} value={s.density} onChange={(v) => s.set({ density: v })} />
      </Group>
      <Group label="Numbers">
        <ToggleRow title="Hide counts" sub="Show likes, reposts and zaps without numbers" checked={s.hideCounts} onChange={(v) => s.set({ hideCounts: v })} />
      </Group>
      <PreviewNote />
    </>
  );
}

function PreviewNote() {
  const me = useActivePubkey();
  const ev = use$(() => (me ? eventStore.timeline({ kinds: [1], authors: [me] }) : eventStore.timeline({ kinds: [1] })), [me]);
  const first = ev?.[0];
  if (!first) return null;
  return (
    <Group label="Preview">
      <NoteCard event={first} preview />
    </Group>
  );
}

function Gestures() {
  const s = useSettings();
  const opts = (Object.keys(SWIPE_ACTIONS) as SwipeAction[]).map((k) => [k, SWIPE_ACTIONS[k].label] as [SwipeAction, string]);
  return (
    <>
      <Group label="Swipe right">
        <ChipSet options={opts} value={s.swipeStart} disabled={s.swipeEnd} onChange={(v) => s.set({ swipeStart: v })} />
      </Group>
      <Group label="Swipe left" help="Every swipe also has a button on the note. Long-press a note for all options.">
        <ChipSet options={opts} value={s.swipeEnd} disabled={s.swipeStart} onChange={(v) => s.set({ swipeEnd: v })} />
      </Group>
      <Group label="Other gestures">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 py-3 text-[15px]">
          <dt className="font-semibold">Pull down</dt>
          <dd className="text-muted">Refresh a feed</dd>
          <dt className="font-semibold">Swipe top bar</dt>
          <dd className="text-muted">Move between feeds</dd>
          <dt className="font-semibold">Long-press a note</dt>
          <dd className="text-muted">All options</dd>
          <dt className="font-semibold">Long-press like</dt>
          <dd className="text-muted">Pick an emoji</dd>
          <dt className="font-semibold">Drag sheet down</dt>
          <dd className="text-muted">Close it</dd>
        </dl>
      </Group>
    </>
  );
}

function Feeds() {
  const feeds = useSettings((s) => s.feeds);
  const set = useSettings((s) => s.set);
  const move = (i: number, d: number) => {
    const next = [...feeds];
    const [f] = next.splice(i, 1);
    next.splice(i + d, 0, f);
    set({ feeds: next });
  };
  return (
    <>
      <Group label="Your feeds" help="Rename a feed by tapping its name. The first feed opens when you start Dusk.">
        {feeds.map((f, i) => (
          <div key={f.id} className="flex items-center gap-1 px-2 py-2">
            <span className="min-w-0 flex-1">
              <input className="w-full rounded-[8px] bg-transparent px-2 py-1 text-[16px] font-semibold outline-none focus:bg-raised" value={f.name} aria-label="Feed name" onChange={(e) => set({ feeds: feeds.map((x) => (x.id === f.id ? { ...x, name: e.target.value } : x)) })} />
              <span className="block px-2 text-[13px] text-muted">
                {SOURCES[f.src]}
                {f.tag ? ` · #${f.tag}` : f.relay ? ` · ${hostOf(f.relay.replace("wss://", "https://"))}` : ""}
              </span>
            </span>
            <button type="button" className="iconbtn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              <Icon name="up" />
            </button>
            <button type="button" className="iconbtn" aria-label="Move down" disabled={i === feeds.length - 1} onClick={() => move(i, 1)}>
              <Icon name="down" />
            </button>
            <button type="button" className="iconbtn" aria-label="Remove feed" disabled={feeds.length < 2} onClick={() => set({ feeds: feeds.filter((x) => x.id !== f.id), activeFeed: feeds[0].id === f.id ? feeds[1].id : feeds[0].id })}>
              <Icon name="trash" />
            </button>
          </div>
        ))}
      </Group>
      <div className="px-4 pt-4">
        <button type="button" className="btn btn-secondary btn-lg" onClick={openFeedAdd}>
          <Icon name="plus" />
          Add a feed
        </button>
      </div>
    </>
  );
}

function Wallet() {
  const w = useWallet();
  const s = useSettings();
  const [uri, setUri] = useState("");
  const [busy, setBusy] = useState(false);
  const me = useActivePubkey();
  useEffect(() => {
    if (w.uri) refreshBalance();
  }, [w.uri]);
  if (!me) return <Empty title="Sign in first">Connect a wallet after signing in.</Empty>;
  return (
    <>
      {w.uri ? (
        <>
          <div className="grid justify-items-center gap-1 px-4 py-8 text-center">
            <span className="caption">Balance</span>
            <b className="text-[32px] leading-10 font-semibold tabular-nums">{w.balance != null ? `${sats(w.balance)} sats` : "…"}</b>
            <span className="caption">{w.alias ? `${w.alias} · ` : ""}Nostr Wallet Connect</span>
            {w.error && <span className="text-[13px] text-clay-ink">{w.error}</span>}
          </div>
          <Group label="Default zap">
            <ChipSet options={[[21, "21"], [100, "100"], [500, "500"], [1000, "1k"], [5000, "5k"]]} value={s.defaultZap} onChange={(v) => s.set({ defaultZap: v })} />
          </Group>
          <Group>
            <ToggleRow title="One-tap zaps" sub="The zap button sends your default amount right away" checked={s.oneTapZap} onChange={(v) => s.set({ oneTapZap: v })} />
          </Group>
          <div className="px-4 pt-6">
            <button type="button" className="btn btn-danger btn-lg" onClick={disconnectWallet}>
              Disconnect wallet
            </button>
          </div>
        </>
      ) : (
        <form
          className="grid gap-4 px-4 pt-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await connectWallet(uri);
              toast("Wallet connected");
            } catch (er) {
              errorToast(er, "Couldn't connect");
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-[15px] text-muted">Connect a Lightning wallet that supports Nostr Wallet Connect (Alby Hub, Coinos, Primal, Mutiny and others). Dusk keeps the connection on this device only.</p>
          <Field label="Connection string" help="Starts with nostr+walletconnect://">
            <input className="field key" type="password" autoComplete="off" placeholder="nostr+walletconnect://…" value={uri} onChange={(e) => setUri(e.target.value)} />
          </Field>
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !uri.startsWith("nostr+walletconnect://")}>
            {busy ? "Connecting…" : "Connect"}
          </button>
          <p className="caption">Without a wallet, zaps show an invoice you can pay from any Lightning app. A browser wallet (WebLN) is used automatically if present.</p>
        </form>
      )}
    </>
  );
}

function Notifications() {
  const s = useSettings();
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "denied");
  return (
    <>
      <Group label="Notify me about">
        <ToggleRow title="Mentions and replies" checked={s.notif.mentions} onChange={(v) => s.setNotif({ mentions: v })} />
        <ToggleRow title="Messages" checked={s.notif.dms} onChange={(v) => s.setNotif({ dms: v })} />
        <ToggleRow title="Zaps" checked={s.notif.zaps} onChange={(v) => s.setNotif({ zaps: v })} />
        <ToggleRow title="New followers" checked={s.notif.follows} onChange={(v) => s.setNotif({ follows: v })} />
        <ToggleRow title="Likes and reposts" sub="Off by default. These add up fast." checked={s.notif.likes} onChange={(v) => s.setNotif({ likes: v })} />
      </Group>
      <Group label="Quiet hours" help="Dusk never puts counts on the app icon.">
        <ToggleRow title="Quiet from 22:00 to 07:00" sub="Notifications wait until morning" checked={s.notif.quiet} onChange={(v) => s.setNotif({ quiet: v })} />
      </Group>
      <Group label="On this device" help="Dusk shows system notifications while it is open in a tab or installed as an app. Nostr has no push service, so notifications can't arrive while Dusk is fully closed.">
        {perm === "granted" ? (
          <Row icon="check" title="System notifications are on" />
        ) : (
          <Row icon="bell" title="Allow system notifications" sub={perm === "denied" ? "Blocked in your browser settings" : undefined} onClick={() => Notification.requestPermission().then(setPerm)} />
        )}
      </Group>
    </>
  );
}

function Muted() {
  const mutes = useMyMutes();
  const [word, setWord] = useState("");
  const me = useActivePubkey();
  if (!me) return <Empty title="Sign in first">Mutes are saved to your Nostr account so every app can use them.</Empty>;
  return (
    <>
      <Group label="People">
        {mutes.pubkeys.size ? (
          [...mutes.pubkeys].map((pk) => (
            <PersonRow
              key={pk}
              pubkey={pk}
              right={
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMute("user", pk, false)}>
                  Unmute
                </button>
              }
            />
          ))
        ) : (
          <p className="px-4 py-3 text-[14px] text-muted">Nobody muted. Swipe or long-press a note to mute its author.</p>
        )}
      </Group>
      <Group label="Words and tags" help="Notes containing these are hidden everywhere. Your mute list is private (encrypted) on Nostr.">
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {[...mutes.words].map((w) => (
            <button key={"w" + w} type="button" className="chip" aria-label={`Remove ${w}`} onClick={() => setMute("word", w, false)}>
              {w}
              <Icon name="close" size={16} />
            </button>
          ))}
          {[...mutes.hashtags].map((t) => (
            <button key={"t" + t} type="button" className="chip" aria-label={`Remove #${t}`} onClick={() => setMute("tag", t, false)}>
              #{t}
              <Icon name="close" size={16} />
            </button>
          ))}
        </div>
        <form
          className="flex gap-2 px-4 pb-3"
          onSubmit={(e) => {
            e.preventDefault();
            const v = word.trim();
            if (!v) return;
            if (v.startsWith("#")) setMute("tag", v.slice(1).toLowerCase(), true);
            else setMute("word", v.toLowerCase(), true);
            setWord("");
          }}
        >
          <input className="field min-h-11 py-2" placeholder="Add a word or #tag" value={word} onChange={(e) => setWord(e.target.value)} />
          <button type="submit" className="btn btn-secondary">
            Add
          </button>
        </form>
      </Group>
      {mutes.threads.size > 0 && (
        <Group label="Threads">
          {[...mutes.threads].map((id) => (
            <Row key={id} title={<span className="key">{middle(id, 12, 6)}</span>} right={<button type="button" className="btn btn-secondary btn-sm" onClick={() => setMute("thread", id, false)}>Unmute</button>} to={"/e/" + id} />
          ))}
        </Group>
      )}
    </>
  );
}

function Safety() {
  const s = useSettings();
  return (
    <>
      <Group label="Web of trust" help="Your network is you, the people you follow, and the people they follow. Replies and activity from outside it are tucked behind a button.">
        <ToggleRow title="Filter by your network" checked={s.wot} onChange={(v) => s.set({ wot: v })} />
      </Group>
      <Group label="Photos and videos">
        <ChipSet options={[["never", "Always show"], ["strangers", "Blur from strangers"], ["always", "Always blur"]]} value={s.blurMedia} onChange={(v) => s.set({ blurMedia: v })} />
      </Group>
      <Group>
        <Row icon="trash" danger title="Request to vanish" sub="Ask servers to delete everything you've posted" to="/settings/vanish" />
      </Group>
    </>
  );
}

function Accessibility() {
  const s = useSettings();
  return (
    <>
      <Group label="Text size">
        <ChipSet options={[["normal", "Default"], ["large", "Larger"]]} value={s.textSize} onChange={(v) => s.set({ textSize: v })} />
      </Group>
      <Group>
        <ToggleRow title="Higher contrast" sub="Stronger text and dividers" checked={s.contrast === "more"} onChange={(v) => s.set({ contrast: v ? "more" : "normal" })} />
        <ToggleRow title="Reduce motion" sub="Turn off animations" checked={s.reduceMotion} onChange={(v) => s.set({ reduceMotion: v })} />
        <ToggleRow title="Data saver" sub="Load photos and avatars only when you tap" checked={s.dataSaver} onChange={(v) => s.set({ dataSaver: v })} />
        <ToggleRow title="Photo description reminder" sub="Ask before posting photos without a description" checked={s.altReminder} onChange={(v) => s.set({ altReminder: v })} />
      </Group>
    </>
  );
}

/* ---------- servers ---------- */

function sameAsDefault(list: { url: string; read: boolean; write: boolean }[]) {
  const d = uniqRelays(DEFAULT_RELAYS);
  return list.length === d.length && list.every((r) => r.read && r.write && d.includes(r.url));
}

function useMyRelays() {
  const me = useActivePubkey();
  const ev = use$(() => (me ? eventStore.replaceable(10002, me) : undefined), [me]);
  return useMemo(() => {
    if (!ev) return DEFAULT_RELAYS.map((url) => ({ url, read: true, write: true }));
    const inbox = new Set(uniqRelays(getInboxes(ev)));
    const outbox = new Set(uniqRelays(getOutboxes(ev)));
    return uniqRelays([...inbox], [...outbox]).map((url) => ({ url, read: inbox.has(url), write: outbox.has(url) }));
  }, [ev]);
}

function useRelayHealth(url: string) {
  const [state, setState] = useState<{ s: "ok" | "slow" | "err" | "off"; ms?: number; name?: string }>({ s: "off" });
  useEffect(() => {
    let alive = true;
    const t0 = performance.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    fetch(url.replace(/^ws/, "http"), { headers: { Accept: "application/nostr+json" }, signal: ctrl.signal })
      .then((r) => r.json())
      .then((info) => {
        if (!alive) return;
        const ms = Math.round(performance.now() - t0);
        setState({ s: ms > 800 ? "slow" : "ok", ms, name: info?.name });
      })
      .catch(() => alive && setState({ s: "err" }))
      .finally(() => clearTimeout(timer));
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [url]);
  return state;
}

function RelayRow({ url, read, write, onToggle, onRemove, editable }: { url: string; read: boolean; write: boolean; onToggle?: (k: "read" | "write") => void; onRemove?: () => void; editable: boolean }) {
  const h = useRelayHealth(url);
  const label = { ok: "Connected", slow: "Slow", err: "Can't connect", off: "Checking…" }[h.s];
  return (
    <div className="flex items-start gap-2 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="key block text-ink">{url}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <StatusDot state={h.s} />
          {label}
          {h.ms != null && <span>{h.ms} ms</span>}
          {h.name && <span>· {h.name}</span>}
        </span>
        {editable && (
          <span className="mt-2 flex gap-2">
            <button type="button" className="chip min-h-8 px-3 text-[13px]" aria-pressed={read} onClick={() => onToggle?.("read")}>
              Read
            </button>
            <button type="button" className="chip min-h-8 px-3 text-[13px]" aria-pressed={write} onClick={() => onToggle?.("write")}>
              Write
            </button>
          </span>
        )}
      </span>
      {editable && (
        <button type="button" className="iconbtn" aria-label={`Remove ${url}`} onClick={onRemove}>
          <Icon name="trash" />
        </button>
      )}
    </div>
  );
}

function Servers() {
  const me = useActivePubkey();
  const current = useMyRelays();
  const [draft, setDraft] = useState<{ url: string; read: boolean; write: boolean }[] | null>(null);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const list = draft ?? current;
  const dirty = !!draft;
  const save = async () => {
    if (!draft) return;
    if (!draft.some((r) => r.write) || !draft.some((r) => r.read)) return setErr("Keep at least one server to read from and one to write to.");
    setBusy(true);
    try {
      const added = draft.map((r) => r.url).filter((u) => !current.some((c) => c.url === u));
      const [, dm] = await Promise.all([ensureLatest(10002), added.length ? ensureLatest(10050) : undefined]);
      const tags = draft.map((r) => (r.read && r.write ? ["r", r.url] : ["r", r.url, r.read ? "read" : "write"]));
      // publish to old and new relays plus the indexers so everyone finds the new list
      await publish({ kind: 10002, tags }, { relays: uniqRelays(draft.map((r) => r.url), LOOKUP_RELAYS), notifyTagged: false });
      // new servers become message servers too, so DMs reach you wherever you read
      if (dm && added.length) {
        const have = dm.tags.filter((t) => t[0] === "relay").map((t) => t[1]);
        await publish({ kind: 10050, tags: uniqRelays(have, added).map((u) => ["relay", u]) }, { notifyTagged: false });
      }
      setDraft(null);
      toast("Servers saved");
    } catch (e) {
      errorToast(e, "Couldn't save");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Group label="Servers (relays)" help="Dusk also follows each person to the servers they publish to (outbox model). These are the servers you read from and write to.">
        {list.map((r, i) => (
          <RelayRow
            key={r.url}
            {...r}
            editable={!!me}
            onToggle={(k) => setDraft(list.map((x, j) => (j === i ? { ...x, [k]: !x[k] } : x)))}
            onRemove={() => setDraft(list.filter((_, j) => j !== i))}
          />
        ))}
      </Group>
      {me ? (
        <form
          className="grid gap-3 px-4 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const n = normalizeRelay(input);
            if (!n) return setErr("That isn't a server address. They start with wss://");
            if (list.some((r) => r.url === n)) return setErr("Already in your list");
            setErr("");
            setDraft([...list, { url: n, read: true, write: true }]);
            setInput("");
          }}
        >
          <Field error={err}>
            <span className="flex gap-2">
              <input className="field key" inputMode="url" placeholder="wss://relay.example.com" value={input} onChange={(e) => setInput(e.target.value)} />
              <button type="submit" className="btn btn-secondary">
                Add
              </button>
            </span>
          </Field>
          {!sameAsDefault(list) && (
            <button type="button" className="btn btn-ghost justify-start" onClick={() => (setDraft(DEFAULT_RELAYS.map((url) => ({ url, read: true, write: true }))), setErr(""))}>
              Use just the {DEFAULT_RELAYS.length} popular servers
            </button>
          )}
          {dirty && (
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={save}>
                {busy ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => (setDraft(null), setErr(""))}>
                Cancel
              </button>
            </div>
          )}
        </form>
      ) : (
        <p className="px-4 pt-4 text-[14px] text-muted">Sign in to choose your own servers.</p>
      )}
    </>
  );
}

function ListEditor({ kind, tag, title, help, suggestions, fallback = [] }: { kind: number; tag: "relay" | "server"; title: string; help: string; suggestions: string[]; fallback?: string[] }) {
  const me = useActivePubkey();
  const ev = use$(() => (me ? eventStore.replaceable(kind, me) : undefined), [me, kind]);
  const saved = useMemo(() => (ev ? (kind === 10063 ? getBlossomServersFromList(ev).map((u) => u.toString().replace(/\/$/, "")) : ev.tags.filter((t) => t[0] === tag).map((t) => t[1])) : []), [ev, kind, tag]);
  // with no list of their own, people use the fallback (e.g. all their servers); edits start from it
  const usingFallback = !saved.length && fallback.length > 0;
  // edits show at once; the pending list wins until the store catches up (or the save fails)
  const [pending, setPending] = useState<string[] | null>(null);
  useEffect(() => setPending((p) => (p && [...p].sort().join() === [...saved].sort().join() ? null : p)), [saved]);
  const current = pending ?? (usingFallback ? fallback : saved);
  const [input, setInput] = useState("");
  const queue = useRef<{ p: Promise<unknown>; t: number }>({ p: Promise.resolve(), t: 0 });
  const save = (next: string[]) => {
    const list = [...new Set(next)];
    setPending(list);
    const q = queue.current;
    // one save at a time, each newer than the last so a quick second tap can't lose to the first
    q.p = q.p.then(async () => {
      try {
        await ensureLatest(kind);
        q.t = Math.max(Math.floor(Date.now() / 1000), q.t + 1);
        await publish({ kind, created_at: q.t, tags: list.map((u) => [tag, u]) }, { notifyTagged: false });
      } catch (e) {
        setPending(null);
        errorToast(e, "Couldn't save");
      }
    });
  };
  const valid = (v: string) => (tag === "relay" ? normalizeRelay(v) : /^https:\/\/\S+$/.test(v) ? v.replace(/\/$/, "") : null);
  const norm = (u: string) => (tag === "relay" ? (normalizeRelay(u) ?? u) : u.replace(/\/$/, ""));
  const have = new Set(current.map(norm));
  const offer = [...new Set(suggestions.map(norm))].filter((u) => !have.has(u));
  return (
    <>
      <Group label={title} help={help}>
        {usingFallback && <p className="px-4 pt-3 text-[13px] text-muted">You haven't picked any yet, so these servers are used. Change them to save your own list.</p>}
        {current.map((u) => (
          <div key={u} className="flex items-center gap-2 px-4 py-3">
            <span className="key min-w-0 flex-1 text-ink">{u}</span>
            <button type="button" className="iconbtn" aria-label={`Remove ${u}`} disabled={current.length < 2} onClick={() => save(current.filter((x) => x !== u))}>
              <Icon name="trash" />
            </button>
          </div>
        ))}
        {!current.length && <p className="px-4 py-3 text-[14px] text-muted">None set.</p>}
      </Group>
      {offer.length > 0 && (
        <Group label="Add with one tap">
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {offer.map((d) => (
              <button key={d} type="button" className="chip text-[13px]" onClick={() => save([...current, d])}>
                <Icon name="plus" size={16} />
                {d.replace(/^wss?:\/\/|^https:\/\//, "")}
              </button>
            ))}
          </div>
        </Group>
      )}
      <form
        className="flex gap-2 px-4 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          const v = valid(input.trim());
          if (!v) return toast("That address doesn't look right");
          save([...current, v]);
          setInput("");
        }}
      >
        <input className="field key" placeholder={tag === "relay" ? "wss://…" : "https://…"} value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit" className="btn btn-secondary">
          Add
        </button>
      </form>
    </>
  );
}

function InboxServers() {
  const mine = useMyRelays();
  const all = mine.map((r) => r.url);
  // without a message-server list, other apps deliver DMs to the servers you read from
  const reading = mine.filter((r) => r.read).map((r) => r.url);
  return (
    <ListEditor
      kind={10050}
      tag="relay"
      title="Message servers"
      help="People send your private messages (NIP-17) to these servers. Servers that require sign-in to read, like auth.nostr1.com, keep them more private."
      fallback={reading}
      suggestions={[...all, "wss://auth.nostr1.com", "wss://relay.0xchat.com", "wss://nos.lol"]}
    />
  );
}

function MediaServers() {
  const s = useSettings();
  return (
    <>
      <Group label="Upload to" help="Photos you post go to this Blossom server first.">
        <ChipSet options={[...new Set([s.mediaServer, ...mediaServers(), "https://blossom.primal.net", "https://nostr.download", "https://blossom.band"])].map((u) => [u, hostOf(u)] as [string, string])} value={s.mediaServer} onChange={(v) => s.set({ mediaServer: v })} />
      </Group>
      <ListEditor kind={10063} tag="server" title="Your media servers" help="Published with your account (BUD-03) so other apps know where your files live." suggestions={[s.mediaServer, "https://blossom.primal.net", "https://nostr.download"]} />
    </>
  );
}

/* ---------- account ---------- */

function Account() {
  const me = useActivePubkey()!;
  const account = useActiveAccount();
  const nav = useNavigate();
  const remove = useAccounts((s) => s.remove);
  if (!account) return <Empty title="Not signed in" />;
  const signer = { extension: "Browser extension", bunker: "Remote signer · your key stays in your signer app", key: "Key kept in this browser" }[account.type];
  return (
    <>
      <Group label="Signing">
        <Row icon="key" title="Signed in with" sub={signer} />
        {account.type === "key" && <Row icon="lock" title="Back up your key" sub="Show or export your private key" onClick={() => openSheet(<Backup />, { label: "Back up your key" })} />}
        {account.type === "bunker" && (
          <Row
            icon="refresh"
            title="Reconnect signer"
            onClick={async () => {
              await lockAccount(me);
              getSigner(me)
                .then(() => toast("Signer connected"))
                .catch((e) => errorToast(e, "Couldn't reach your signer"));
            }}
          />
        )}
      </Group>
      <Group label="Public key" help="Share this so people can find you. It is safe to share.">
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="key min-w-0 flex-1">{npub(me)}</span>
          <button type="button" className="iconbtn" aria-label="Copy public key" onClick={() => copyText(npub(me), "Copied public key")}>
            <Icon name="copy" />
          </button>
        </div>
      </Group>
      <div className="px-4 pt-6">
        <button
          type="button"
          className="btn btn-danger btn-lg"
          onClick={() => {
            if (!confirm(account.type === "key" ? "Sign out and remove the key from this browser? Make sure you have a backup." : "Sign out of this identity on this device?")) return;
            lockAccount(me);
            remove(me);
            nav("/");
            toast("Signed out");
          }}
        >
          <Icon name="logout" />
          Sign out
        </button>
      </div>
    </>
  );
}

function Backup() {
  const account = useActiveAccount();
  const [shown, setShown] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"nsec" | "ncryptsec">("nsec");
  if (!account || account.type !== "key") return null;
  if (!account.secret) return <p className="text-[15px] text-muted">Use your key once (post or react) so Dusk can open it, then come back here.</p>;
  const sk = hexToBytes(account.secret);
  return (
    <div className="grid gap-3">
      <h2 className="text-xl font-semibold">Back up your key</h2>
      <p className="text-[15px] text-muted">Your private key (nsec) is your account. Anyone who sees it can post as you. An encrypted copy (ncryptsec) needs a password you choose, which makes it safer to store.</p>
      <ChipSet options={[["nsec", "Private key"], ["ncryptsec", "Encrypted copy"]]} value={mode} onChange={(v) => (setMode(v), setShown(null))} />
      {mode === "nsec" && !shown && (
        <>
          <Warn>Only reveal it on a device nobody is watching.</Warn>
          <button type="button" className="btn btn-danger" onClick={() => setShown(nsecEncode(sk))}>
            Reveal private key
          </button>
        </>
      )}
      {mode === "ncryptsec" && !shown && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (pw.length >= 8) setShown(encryptKey(sk, pw));
          }}
        >
          <input className="field" type="password" autoComplete="new-password" placeholder="Choose a password (8+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={pw.length < 8}>
            Create encrypted copy
          </button>
        </form>
      )}
      {shown && (
        <>
          <div className="key rounded-[10px] bg-surface p-3 break-all text-ink select-all">{shown}</div>
          <button type="button" className="btn btn-secondary" onClick={() => copyText(shown, "Copied")}>
            <Icon name="copy" size={18} />
            Copy
          </button>
        </>
      )}
    </div>
  );
}

/* ---------- advanced ---------- */

function Advanced() {
  const s = useSettings();
  return (
    <>
      <Group>
        <ToggleRow title="Show raw details" sub="Adds event IDs and kinds in note details" checked={s.advanced} onChange={(v) => s.set({ advanced: v })} />
      </Group>
      <Group label="Storage" help="Dusk keeps notes, profiles and decrypted messages on this device so it opens fast and works offline.">
        <Row
          icon="trash"
          title="Clear cached notes"
          sub="They'll load again from servers"
          onClick={async () => {
            await clearCache();
            toast("Cache cleared");
          }}
        />
        <Row
          icon="trash"
          danger
          title="Clear decrypted messages"
          sub="Messages will be decrypted again next time"
          onClick={async () => {
            if (!confirm("Remove decrypted messages from this device?")) return;
            await kvClear();
            toast("Cleared. Reload to decrypt again.");
          }}
        />
      </Group>
    </>
  );
}

function Vanish() {
  const me = useActivePubkey();
  const [scope, setScope] = useState<"all" | "mine">("mine");
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const relays = useMyRelays();
  if (!me) return <Empty title="Sign in first" />;
  return (
    <div className="grid gap-4 px-4 pt-4">
      <Warn>A request to vanish (NIP-62) asks servers to delete everything signed by your key and refuse it in future. It can't be undone, and servers that ignore it keep their copies.</Warn>
      <ChipSet options={[["mine", "My servers"], ["all", "Every server"]]} value={scope} onChange={(v) => setScope(v)} label="Scope" />
      <p className="caption">{scope === "mine" ? `${relays.length} servers from your list` : "Sent to your servers with a request addressed to all relays"}</p>
      <textarea className="field" rows={2} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Field label='Type "vanish" to confirm'>
        <input className="field" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
      </Field>
      <button
        type="button"
        className="btn btn-danger btn-lg"
        disabled={confirmText.trim().toLowerCase() !== "vanish" || busy}
        onClick={async () => {
          setBusy(true);
          try {
            const tags = scope === "all" ? [["relay", "ALL_RELAYS"]] : relays.map((r) => ["relay", r.url]);
            await (await publish({ kind: 62, content: reason, tags }, { relays: relays.map((r) => r.url), notifyTagged: false })).sent;
            toast("Request sent");
          } catch (e) {
            errorToast(e, "Couldn't send");
          } finally {
            setBusy(false);
          }
        }}
      >
        Send request to vanish
      </button>
    </div>
  );
}

function About() {
  return (
    <div className="grid justify-items-center gap-3 px-6 py-10 text-center">
      <span className="size-12 rounded-full bg-[linear-gradient(180deg,var(--lilac)_0_46%,var(--peach)_46%_62%,var(--mist)_62%)]" />
      <h2 className="text-xl font-semibold">Dusk</h2>
      <p className="max-w-sm text-[15px] text-muted">Version {__APP_VERSION__}. A calm Nostr client for phones and desktops. Built with React, Tailwind and applesauce.</p>
      <a className="btn btn-secondary" href="https://github.com/kucukkanat/dusk" target="_blank" rel="noreferrer">
        Source code
      </a>
      <button type="button" className="btn btn-secondary" onClick={openShortcuts}>
        <Icon name="keyboard" />
        Keyboard shortcuts
      </button>
      <Link to="/" className="btn btn-ghost" onClick={() => openOnboarding("welcome", "add")}>
        Replay onboarding
      </Link>
    </div>
  );
}

