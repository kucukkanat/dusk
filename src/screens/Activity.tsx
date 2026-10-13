import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { use$ } from "applesauce-react/hooks";
import { useNotifications, useNotifRead, useNotifLoading, rememberFollowers, type Notif } from "../nostr/notifications";
import { eventStore } from "../nostr/core";
import { useActivePubkey } from "../state/accounts";
import { useMyMutes, setMute } from "../nostr/lists";
import { useWot } from "../nostr/wot";
import { displayName } from "../nostr/profile";
import { profilePath, eventPath } from "../lib/links";
import { ago, sats } from "../lib/format";
import { toast } from "../state/ui";
import { Screen, Chips } from "../ui/Screen";
import { Empty, Endcap, Avatar, FeedSkeleton } from "../ui/primitives";
import { SwipeRow } from "../ui/SwipeRow";
import { Icon, type IconName } from "../ui/Icon";
import { openOnboarding } from "./Onboarding";

type Filter = "all" | "mentions" | "zaps" | "follows";
const NK: Record<Notif["kind"], { tone: string; icon: IconName }> = {
  like: { tone: "bg-rose", icon: "like" },
  zap: { tone: "bg-peach", icon: "zap" },
  mention: { tone: "bg-lilac", icon: "at" },
  reply: { tone: "bg-mist", icon: "reply" },
  quote: { tone: "bg-lilac", icon: "quote" },
  follow: { tone: "bg-sage", icon: "user" },
  repost: { tone: "bg-sage", icon: "repost" },
};

function Excerpt({ id }: { id?: string }) {
  const ev = use$(() => (id ? eventStore.event(id) : undefined), [id]);
  if (!ev) return null;
  return <span className="mt-0.5 line-clamp-2 block text-[14px] leading-5 text-muted">{ev.content.replace(/nostr:\S+/g, "…").slice(0, 200)}</span>;
}

function Row({ n }: { n: Notif }) {
  const nav = useNavigate();
  const toggle = useNotifRead((s) => s.toggle);
  const k = NK[n.kind];
  const names = n.who.slice(0, 2).map(displayName);
  const others = n.who.length - names.length;
  const who = <b className="font-semibold">{names.join(", ") + (others > 0 ? ` and ${others} ${others === 1 ? "other" : "others"}` : "")}</b>;
  const text = {
    like: <>{who} {n.emoji && n.emoji !== "+" ? `reacted ${n.emoji.startsWith(":") ? "" : n.emoji} to` : "liked"} your note</>,
    repost: <>{who} reposted your note</>,
    zap: <>{who} zapped you {sats(n.amount ?? 0)} sats</>,
    reply: <>{who} replied</>,
    mention: <>{who} mentioned you</>,
    quote: <>{who} quoted your note</>,
    follow: <>{who} followed you</>,
  }[n.kind];
  const go = () => {
    if (n.unread) toggle(n.id, false);
    if (n.kind === "follow") nav(profilePath(n.who[0]));
    else if (n.kind === "reply" || n.kind === "mention" || n.kind === "quote") nav(eventPath(n.event));
    else if (n.target) nav("/e/" + n.target);
  };
  return (
    <SwipeRow
      start={{ label: n.unread ? "Mark read" : "Mark unread", icon: "check", tone: "lilac", run: () => toggle(n.id, !n.unread) }}
      end={{
        label: `Mute ${names[0]?.split(" ")[0] ?? ""}`,
        icon: "mute",
        tone: "clay",
        run: () => setMute("user", n.who[0], true).then(() => toast(`Muted ${names[0]}`, { undo: () => setMute("user", n.who[0], false) })),
      }}
    >
      <button type="button" className={`grid w-full grid-cols-[40px_1fr_auto] gap-3 px-4 py-3 text-left ${n.unread ? "" : "opacity-80"}`} onClick={go}>
        <span className="relative">
          <Avatar pubkey={n.who[0]} />
          <span className={`absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full ${k.tone} text-on-accent shadow-[0_0_0_2px_var(--surface)]`}>
            <Icon name={k.icon} size={12} />
          </span>
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] leading-[21px]">{text}</span>
          {n.kind === "zap" && n.comment && <span className="mt-0.5 block text-[14px] text-ink">“{n.comment}”</span>}
          {(n.kind === "reply" || n.kind === "mention" || n.kind === "quote") && <span className="mt-0.5 line-clamp-3 block text-[14px] leading-5 text-muted">{n.event.content.slice(0, 280)}</span>}
          {(n.kind === "like" || n.kind === "repost" || n.kind === "zap") && <Excerpt id={n.target} />}
        </span>
        <span className="flex flex-col items-end gap-1 text-[13px] text-muted tabular-nums">
          {ago(n.t)}
          {n.unread && <span className="size-2 rounded-full bg-lilac-ink" aria-label="Unread" />}
        </span>
      </button>
    </SwipeRow>
  );
}

export function Activity() {
  const me = useActivePubkey();
  const all = useNotifications();
  const mutes = useMyMutes();
  const wot = useWot();
  const markAll = useNotifRead((s) => s.markAll);
  const loading = useNotifLoading((s) => s.loading);
  const [f, setF] = useState<Filter>("all");
  const [showStrangers, setShowStrangers] = useState(false);

  const items = useMemo(
    () =>
      all.filter((n) => {
        if (n.who.every((w) => mutes.pubkeys.has(w))) return false;
        if (f === "mentions") return n.kind === "mention" || n.kind === "reply" || n.kind === "quote";
        if (f === "zaps") return n.kind === "zap";
        if (f === "follows") return n.kind === "follow";
        return true;
      }),
    [all, mutes, f],
  );
  const trusted = wot && !showStrangers ? items.filter((n) => n.kind === "zap" || n.who.some((w) => wot.has(w))) : items;
  const hidden = items.length - trusted.length;

  useEffect(() => {
    rememberFollowers(all.filter((n) => n.kind === "follow").map((n) => n.who[0]));
  }, [all]);

  if (!me)
    return (
      <Screen title="Activity">
        <Empty title="Sign in to see activity" action={<button type="button" className="btn btn-primary" onClick={() => openOnboarding("signin")}>Sign in</button>}>
          Mentions, replies and zaps will show up here.
        </Empty>
      </Screen>
    );

  return (
    <Screen
      title="Activity"
      fab
      actions={
        all.some((n) => n.unread) && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={markAll}>
            Mark all read
          </button>
        )
      }
      sub={
        <Chips label="Filter activity">
          {(
            [
              ["all", "All"],
              ["mentions", "Mentions and replies"],
              ["zaps", "Zaps"],
              ["follows", "Follows"],
            ] as [Filter, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" role="tab" className="chip" aria-selected={f === k} onClick={() => setF(k)}>
              {l}
            </button>
          ))}
        </Chips>
      }
    >
      {trusted.length ? (
        <>
          <div className="[&>*+*]:border-t [&>*+*]:border-line">
            {trusted.map((n) => (
              <Row key={n.id} n={n} />
            ))}
          </div>
          {hidden > 0 && (
            <div className="px-4 py-4">
              <button type="button" className="btn btn-secondary w-full" onClick={() => setShowStrangers(true)}>
                Show {hidden} from people outside your network
              </button>
            </div>
          )}
          {loading ? <FeedSkeleton count={2} label="Loading activity" /> : <Endcap>That's everything from the last two weeks</Endcap>}
        </>
      ) : loading ? (
        <FeedSkeleton label="Loading activity" />
      ) : hidden > 0 ? (
        <Empty
          title="All quiet from your network"
          action={
            <button type="button" className="btn btn-secondary" onClick={() => setShowStrangers(true)}>
              Show {hidden} {hidden === 1 ? "other" : "others"}
            </button>
          }
        >
          Nothing from people you follow or their friends yet.
        </Empty>
      ) : (
        <Empty title="All quiet">Mentions, replies and zaps will show up here.</Empty>
      )}
    </Screen>
  );
}
