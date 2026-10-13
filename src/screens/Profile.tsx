import { useCallback, useEffect, useMemo, useState } from "react";
import { EMPTY, catchError, merge, take, takeUntil, timer } from "rxjs";
import { RelayGroup } from "applesauce-relay";
import { useParams, Link, Navigate } from "react-router";
import { use$ } from "applesauce-react/hooks";
import { getContacts } from "applesauce-core/helpers/contacts";
import { getProfileBadgeSlots } from "applesauce-common/helpers/profile-badges";
import { getBadgeImage, getBadgeName } from "applesauce-common/helpers/badge";
import QRCode from "qrcode";
import { eventStore, pool, quick, healthy, readRelays$, uniqRelays, LOOKUP_RELAYS, DEFAULT_RELAYS } from "../nostr/core";
import { useProfile, nameOf, pictureOf, toneOf, formatNip05 } from "../nostr/profile";
import { profileSpec, isReply } from "../nostr/feeds";
import { useTimeline } from "../nostr/timeline";
import { useActivePubkey } from "../state/accounts";
import { useFollowing, useMyMutes, setMute, addToSet, createSet } from "../nostr/lists";
import { pubkeyFrom, npub, shareUrl, profilePath, eventPath } from "../lib/links";
import { openSheet, closeSheet, copyText, toast, openLightbox, replaceSheet, errorToast } from "../state/ui";
import { Screen, Chips } from "../ui/Screen";
import { Avatar, Nip05, Empty, Endcap, Field, FeedSkeleton } from "../ui/primitives";
import { PersonRow, FollowButton } from "../ui/PersonRow";
import { NoteList } from "../note/NoteCard";
import { Icon } from "../ui/Icon";
import { RichText } from "../note/Content";
import { openZap } from "../sheets/Zap";
import { ReportSheet } from "../sheets/NoteMenu";
import { requireSignIn } from "../note/actions";
import { openEditProfile } from "../sheets/EditProfile";
import { conversationId } from "../nostr/dms";
import { canZap } from "../nostr/zaps";
import { fmtCount, hostOf, middle } from "../lib/format";

export function Me() {
  const me = useActivePubkey();
  if (!me)
    return (
      <Screen title="You">
        <SignedOut />
      </Screen>
    );
  return <ProfileView pubkey={me} isMeTab />;
}

function SignedOut() {
  return (
    <Empty
      title="You're looking around"
      action={
        <button type="button" className="btn btn-primary" onClick={() => import("./Onboarding").then((m) => m.openOnboarding("welcome"))}>
          Create an account or sign in
        </button>
      }
    >
      Sign in to post, follow people, react and send private messages.
    </Empty>
  );
}

export function Profile() {
  const { id = "" } = useParams();
  const pk = pubkeyFrom(id) ?? (/^[0-9a-f]{64}$/.test(id) ? id : null);
  const me = useActivePubkey();
  if (!pk) return <Navigate to="/" replace />;
  if (pk === me) return <ProfileView pubkey={pk} />;
  return <ProfileView pubkey={pk} />;
}

type Tab = "notes" | "replies" | "media" | "articles";

/** Relays that answer NIP-45 COUNT for follow lists. */
const COUNT_RELAYS = ["wss://relay.nostr.band", "wss://purplepag.es", "wss://nos.lol"];
const followerCounts = new Map<string, Promise<number | null>>();

/** Follower count via NIP-45 (the largest answer within 3s), once per person per session. null when no relay answers. */
function countFollowers(pubkey: string): Promise<number | null> {
  let p = followerCounts.get(pubkey);
  if (!p) {
    p = new Promise((resolve) => {
      let best: number | null = null;
      merge(...COUNT_RELAYS.map((url) => pool.relay(url).count({ kinds: [3], "#p": [pubkey] }).pipe(take(1), catchError(() => EMPTY))))
        .pipe(takeUntil(timer(3000)))
        .subscribe({ next: (r) => (best = Math.max(best ?? 0, r.count)), complete: () => resolve(best), error: () => resolve(best) });
    });
    followerCounts.set(pubkey, p);
    p.then((n) => n === null && followerCounts.delete(pubkey));
  }
  return p;
}

function useFollowerCount(pubkey: string) {
  const [n, setN] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setN(undefined);
    countFollowers(pubkey).then((c) => alive && setN(c));
    return () => {
      alive = false;
    };
  }, [pubkey]);
  return n;
}

/** Up to 200 people who follow `pubkey`, from two indexers. Kept out of the store: follow lists are heavy and only shown here. */
function loadFollowers(pubkey: string): Promise<string[]> {
  return new Promise((resolve) => {
    const out = new Set<string>();
    const complete = RelayGroup.completeOnAny(RelayGroup.completeAfterFirstRelay(1500), RelayGroup.completeOnAllEose());
    pool
      .request(healthy(["wss://relay.nostr.band", LOOKUP_RELAYS[0]]), [{ kinds: [3], "#p": [pubkey], limit: 200 }], { complete, timeout: 6000 } as never)
      .pipe(takeUntil(timer(6000)))
      .subscribe({
        next: (e) => getContacts(e).some((p) => p.pubkey === pubkey) && out.add(e.pubkey),
        complete: () => resolve([...out]),
        error: () => resolve([...out]),
      });
  });
}

function FollowersSheet({ pubkey, count }: { pubkey: string; count?: number | null }) {
  const [list, setList] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadFollowers(pubkey).then((l) => alive && setList(l));
    return () => {
      alive = false;
    };
  }, [pubkey]);
  if (!list)
    return (
      <div className="grid gap-2">
        <h2 className="text-xl font-semibold">Followers {count != null && <span className="text-muted">{fmtCount(count)}</span>}</h2>
        <FeedSkeleton count={3} label="Loading followers" />
      </div>
    );
  return <PeopleList title="Followers" pubkeys={list} />;
}

function ProfileView({ pubkey, isMeTab }: { pubkey: string; isMeTab?: boolean }) {
  const me = useActivePubkey();
  const isMe = pubkey === me;
  const p = useProfile(pubkey);
  const following = useFollowing(pubkey);
  const myFollowing = useFollowing(me);
  const followers = useFollowerCount(pubkey);
  const mutes = useMyMutes();
  const muted = mutes.pubkeys.has(pubkey);
  const [tab, setTab] = useState<Tab>("notes");
  const spec = useMemo(() => profileSpec(pubkey, tab), [pubkey, tab]);
  const { events: loaded, loading, done, loadedOnce, timeline } = useTimeline(spec);
  // replies we already hold (from threads and notifications) show while their timeline is still filling
  const events = useMemo(() => {
    if (tab !== "replies" || loaded.length >= 10) return loaded;
    const ids = new Set(loaded.map((e) => e.id));
    const local = eventStore.getByFilters({ kinds: [1], authors: [pubkey] }).filter((e) => !ids.has(e.id) && isReply(e));
    return local.length ? [...loaded, ...local].sort((a, b) => b.created_at - a.created_at) : loaded;
  }, [tab, loaded, pubkey]);
  const name = nameOf(p, pubkey);
  const followsYou = !!me && !isMe && following.has(me);
  const pic = pictureOf(p);
  const contactsLoaded = use$(() => eventStore.replaceable(3, pubkey), [pubkey]);

  const onEnd = useCallback(() => timeline?.loadMore(), [timeline]);
  const onRefresh = useCallback(() => timeline?.refresh(), [timeline]);

  const about = useMemo(() => (p?.about ? { ...({} as object), kind: 0, content: p.about, tags: [], pubkey, created_at: 0, id: "about:" + pubkey, sig: "" } : null), [p?.about, pubkey]);

  return (
    <Screen
      back={!isMeTab}
      title={isMeTab ? "You" : name}
      fab={isMe}
      onEnd={onEnd}
      onRefresh={onRefresh}
      scrollKey={"profile:" + pubkey}
      actions={
        isMe ? (
          <Link to="/settings" className="iconbtn" aria-label="Settings">
            <Icon name="settings" />
          </Link>
        ) : (
          <button type="button" className="iconbtn" aria-label="More options" onClick={() => openSheet(<ProfileMenu pubkey={pubkey} muted={muted} />, { label: "Profile options" })}>
            <Icon name="more" />
          </button>
        )
      }
    >
      {p?.banner ? (
        <button type="button" className="block h-32 w-full overflow-hidden bg-raised md:h-40" onClick={(e) => openLightbox([p.banner!], 0, undefined, e.currentTarget.firstElementChild)} aria-label="View banner">
          <img src={p.banner} alt="" className="size-full object-cover" />
        </button>
      ) : (
        <div className="h-24 md:h-32" style={{ background: `linear-gradient(180deg, var(--${toneOf(pubkey)}) 0%, transparent 140%)`, opacity: 0.7 }} />
      )}
      <div className="bg-surface px-4 pb-4">
        <div className="-mt-9 flex items-end justify-between gap-2">
          <button type="button" className="rounded-full shadow-[0_0_0_4px_var(--surface)]" onClick={(e) => (isMe ? openEditProfile() : pic && openLightbox([pic], 0, undefined, e.currentTarget.firstElementChild))} aria-label={isMe ? "Edit profile" : `View ${name}'s photo`}>
            <Avatar pubkey={pubkey} size="lg" morphKey={"avatar:" + pubkey} />
          </button>
          <div className="flex gap-2 pb-1">
            {isMe ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={openEditProfile}>
                <Icon name="edit" size={18} />
                Edit profile
              </button>
            ) : muted ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMute("user", pubkey, false)}>
                Unmute
              </button>
            ) : (
              <>
                <Link to={"/messages/" + conversationId(me ?? "", [pubkey])} className="btn btn-secondary btn-sm px-3" aria-label={`Message ${name}`} onClick={(e) => !requireSignIn() && e.preventDefault()}>
                  <Icon name="message" size={18} />
                </Link>
                {canZap(pubkey) && (
                  <button type="button" className="btn btn-secondary btn-sm px-3" aria-label={`Zap ${name}`} onClick={() => requireSignIn() && openZap({ pubkey })}>
                    <Icon name="zap" size={18} />
                  </button>
                )}
                <button type="button" className="btn btn-secondary btn-sm px-3" aria-label={`Add ${name} to a list`} title="Add to a list" onClick={() => requireSignIn() && openSheet(<AddToList pubkey={pubkey} />, { label: "Add to a list" })}>
                  <Icon name="list" size={18} />
                </button>
                <FollowButton pubkey={pubkey} small />
              </>
            )}
          </div>
        </div>
        <h2 className="mt-3 text-[22px] leading-7 font-semibold">{name}</h2>
        <Nip05 pubkey={pubkey} />
        {about && (
          <div className="mt-2 text-[15px] leading-[22px]">
            <RichText event={about as never} hideMedia />
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-muted">
          {p?.website && (
            <a href={/^https?:/.test(p.website) ? p.website : "https://" + p.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-ink">
              <Icon name="link" size={16} />
              {hostOf(/^https?:/.test(p.website) ? p.website : "https://" + p.website)}
            </a>
          )}
          {p?.lud16 && (
            <span className="inline-flex items-center gap-1">
              <Icon name="zap" size={16} />
              {p.lud16}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[14px]">
          <button type="button" className="hover:underline" onClick={() => openSheet(<PeopleList title="Following" pubkeys={[...following]} />, { label: "Following" })}>
            <b className="font-semibold">{contactsLoaded ? fmtCount(following.size) : "…"}</b> <span className="text-muted">following</span>
          </button>
          {followers !== null && (
            <button type="button" className="hover:underline" onClick={() => openSheet(<FollowersSheet pubkey={pubkey} count={followers} />, { label: "Followers" })}>
              <b className="font-semibold">{followers === undefined ? "…" : fmtCount(followers)}</b> <span className="text-muted">followers</span>
            </button>
          )}
          {followsYou && <span className="rounded-full bg-raised px-2 py-0.5 text-[12px] text-muted">Follows you</span>}
          {!isMe && me && myFollowing.has(pubkey) && <span className="sr-only">You follow them</span>}
        </div>
        <div className="mt-3 flex items-center gap-1">
          <span className="key min-w-0 truncate">{middle(npub(pubkey), 14, 8)}</span>
          <button type="button" className="iconbtn" aria-label="Copy public key" onClick={() => copyText(npub(pubkey), "Copied public key")}>
            <Icon name="copy" size={18} />
          </button>
          <button type="button" className="iconbtn" aria-label="Show QR code" onClick={() => openSheet(<QrSheet pubkey={pubkey} />, { label: "QR code" })}>
            <Icon name="qr" size={18} />
          </button>
        </div>
        <Badges pubkey={pubkey} />
      </div>
      <Chips label="Profile sections">
        {(
          [
            ["notes", "Notes"],
            ["replies", "Replies"],
            ["media", "Media"],
            ["articles", "Articles"],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} type="button" role="tab" className="chip" aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
        {isMe && (
          <Link to="/bookmarks" className="chip">
            <Icon name="bookmark" size={16} />
            Bookmarks
          </Link>
        )}
      </Chips>
      {muted && !isMe ? (
        <Empty title={`You muted ${name}`}>Their notes are hidden everywhere.</Empty>
      ) : (
        <>
          <NoteList events={events} />
          {loading && <FeedSkeleton count={2} />}
          {loadedOnce && !loading && !events.length && <Empty title="Nothing here yet">{tab === "articles" ? "No long reads yet." : tab === "media" ? "No photos or videos yet." : "Notes will show up here."}</Empty>}
          {done && events.length > 0 && <Endcap>That's everything</Endcap>}
        </>
      )}
    </Screen>
  );
}

const badgesLoaded = new Set<string>();

function Badges({ pubkey }: { pubkey: string }) {
  const stored = use$(() => eventStore.timeline({ kinds: [10008, 30008], authors: [pubkey] }), [pubkey]);
  const ev = stored?.[0];
  useEffect(() => {
    if (badgesLoaded.has(pubkey)) return;
    badgesLoaded.add(pubkey);
    quick(uniqRelays(readRelays$.value, DEFAULT_RELAYS), [{ kinds: [10008, 30008], authors: [pubkey] }]);
  }, [pubkey]);
  const slots = useMemo(() => (ev ? getProfileBadgeSlots(ev).slice(0, 12) : []), [ev]);
  if (!slots.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {slots.map((s) => (
        <BadgeIcon key={s.badge.pubkey + s.badge.identifier} pointer={s.badge} />
      ))}
    </div>
  );
}

function BadgeIcon({ pointer }: { pointer: { kind: number; pubkey: string; identifier: string } }) {
  const ev = use$(() => eventStore.addressable(pointer), [pointer.pubkey, pointer.identifier]);
  if (!ev) return <span className="size-9 rounded-[10px] bg-raised" />;
  const img = getBadgeImage(ev);
  return (
    <Link to={eventPath(ev)} title={getBadgeName(ev)} className="block size-9 overflow-hidden rounded-[10px] bg-raised">
      {img ? <img src={img.url} alt={getBadgeName(ev) ?? "Badge"} className="size-full object-cover" /> : <Icon name="badge" className="m-1.5 text-lilac-ink" />}
    </Link>
  );
}

export function PeopleList({ title, pubkeys }: { title: string; pubkeys: string[] }) {
  const [n, setN] = useState(40);
  useEffect(() => {
    const missing = pubkeys.slice(0, n).filter((p) => !eventStore.hasReplaceable(0, p));
    if (missing.length) quick(uniqRelays(LOOKUP_RELAYS, DEFAULT_RELAYS), [{ kinds: [0], authors: missing }]);
  }, [pubkeys, n]);
  return (
    <div className="grid gap-2">
      <h2 className="text-xl font-semibold">
        {title} <span className="text-muted">{pubkeys.length}</span>
      </h2>
      <div className="-mx-5 [&>*+*]:border-t [&>*+*]:border-line">
        {pubkeys.slice(0, n).map((pk) => (
          <PersonRow key={pk} pubkey={pk} onNavigate={() => closeSheet()} />
        ))}
      </div>
      {pubkeys.length > n && (
        <button type="button" className="btn btn-secondary" onClick={() => setN(n + 60)}>
          Show more
        </button>
      )}
      {!pubkeys.length && <p className="caption py-4 text-center">Nobody yet.</p>}
    </div>
  );
}

function QrSheet({ pubkey }: { pubkey: string }) {
  const [img, setImg] = useState("");
  const p = useProfile(pubkey);
  useEffect(() => {
    QRCode.toDataURL("nostr:" + npub(pubkey), { margin: 1, width: 280 }).then(setImg);
  }, [pubkey]);
  return (
    <div className="grid justify-items-center gap-3 text-center">
      <Avatar pubkey={pubkey} size="lg" />
      <h2 className="text-xl font-semibold">{nameOf(p, pubkey)}</h2>
      {p?.nip05 && <p className="caption -mt-2">{formatNip05(p.nip05)}</p>}
      {img && <img src={img} alt="QR code of this public key" className="size-[240px] rounded-[14px] bg-white p-2" />}
      <span className="key">{middle(npub(pubkey), 16, 8)}</span>
      <div className="grid w-full grid-cols-2 gap-2">
        <button type="button" className="btn btn-secondary" onClick={() => copyText(npub(pubkey), "Copied public key")}>
          Copy key
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => copyText(shareUrl(profilePath(pubkey)), "Copied link")}>
          Copy link
        </button>
      </div>
    </div>
  );
}

function ProfileMenu({ pubkey, muted }: { pubkey: string; muted: boolean }) {
  const name = nameOf(useProfile(pubkey), pubkey);
  const Item = ({ icon, label, onClick, danger }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; onClick: () => void; danger?: boolean }) => (
    <li>
      <button type="button" className={`flex min-h-[52px] w-full items-center gap-3 rounded-[8px] px-2 text-left text-[15px] font-medium hover:bg-wash ${danger ? "text-clay-ink" : ""}`} onClick={onClick}>
        <Icon name={icon} className={danger ? "" : "text-muted"} />
        {label}
      </button>
    </li>
  );
  return (
    <ul className="grid gap-1">
      <Item icon="link" label="Copy link to profile" onClick={() => (closeSheet(), copyText(shareUrl(profilePath(pubkey)), "Copied link"))} />
      <Item icon="copy" label="Copy public key" onClick={() => (closeSheet(), copyText(npub(pubkey), "Copied public key"))} />
      <Item icon="list" label="Add to a list" onClick={() => requireSignIn() && replaceSheet(<AddToList pubkey={pubkey} />)} />
      <Item
        icon="mute"
        label={muted ? `Unmute ${name}` : `Mute ${name}`}
        onClick={() => {
          closeSheet();
          if (requireSignIn()) setMute("user", pubkey, !muted).then(() => toast(muted ? "Unmuted" : `Muted ${name}`));
        }}
      />
      <Item icon="flag" label={`Report ${name}`} danger onClick={() => requireSignIn() && replaceSheet(<ReportSheet pubkey={pubkey} />)} />
    </ul>
  );
}

function AddToList({ pubkey }: { pubkey: string }) {
  const me = useActivePubkey();
  const sets = use$(() => (me ? eventStore.timeline({ kinds: [30000], authors: [me] }) : undefined), [me]) ?? [];
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-3">
      <h2 className="text-xl font-semibold">Add to a list</h2>
      {sets.map((s) => {
        const d = s.tags.find((t) => t[0] === "d")?.[1] ?? "";
        const on = s.tags.some((t) => t[0] === "p" && t[1] === pubkey);
        return (
          <label key={s.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-line p-3">
            <span>
              <b className="block text-[15px]">{s.tags.find((t) => t[0] === "title")?.[1] ?? d}</b>
              <span className="caption">{s.tags.filter((t) => t[0] === "p").length} people</span>
            </span>
            <input type="checkbox" className="toggle" checked={on} onChange={(e) => addToSet(pubkey, d, e.target.checked)} />
          </label>
        );
      })}
      <Field label="New list">
        <input className="field" placeholder="e.g. Photographers" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <button
        type="button"
        className="btn btn-primary"
        disabled={!title.trim() || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await createSet(title.trim(), [pubkey]);
            toast("List created");
            setTitle("");
          } catch (e) {
            errorToast(e, "Couldn't create list");
          } finally {
            setBusy(false);
          }
        }}
      >
        Create list
      </button>
    </div>
  );
}

