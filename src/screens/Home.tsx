import { useMemo, useState } from "react";
import { useActivePubkey } from "../state/accounts";
import { useSettings, type Feed, type FeedSource } from "../state/settings";
import { feedSpec } from "../nostr/feeds";
import { useTimeline } from "../nostr/timeline";
import { useMyMutes, isMuted } from "../nostr/lists";
import { normalizeRelay } from "../nostr/core";
import { openSheet, closeSheet, toast } from "../state/ui";
import { Screen, Chips } from "../ui/Screen";
import { NoteList } from "../note/NoteCard";
import { Empty, Endcap, Field, FeedSkeleton } from "../ui/primitives";
import { Icon } from "../ui/Icon";
import { openOnboarding } from "./Onboarding";
import { use$ } from "applesauce-react/hooks";
import { eventStore } from "../nostr/core";

export const SOURCES: Record<FeedSource, string> = {
  following: "People you follow",
  fof: "Friends of friends",
  global: "Everyone on your servers",
  tag: "A hashtag",
  long: "Long reads from people you follow",
  relay: "One server",
  set: "One of your lists",
  pictures: "Pictures from people you follow",
  video: "Videos from people you follow",
};

export function FeedView({ feed }: { feed: Feed }) {
  const me = useActivePubkey();
  const spec = useMemo(() => feedSpec(feed, me), [feed, me]);
  const { events, fresh, loading, done, loadedOnce, error, timeline } = useTimeline(spec);
  const mutes = useMyMutes();
  const visible = useMemo(() => events.filter((e) => !isMuted(e, mutes)), [events, mutes]);
  const needsSignIn = !me && (feed.src === "fof" || feed.src === "set");

  return (
    <>
      {fresh.length > 0 && (
        <div className="sticky top-2 z-10 flex justify-center">
          <button type="button" className="btn btn-primary btn-sm rounded-full shadow-[var(--shadow-sheet)]" onClick={() => (timeline?.showFresh(), document.querySelector("[data-scroller]")?.scrollTo({ top: 0, behavior: "smooth" }))}>
            <Icon name="up" size={16} />
            {fresh.length === 1 ? "1 new note" : `${fresh.length} new notes`}
          </button>
        </div>
      )}
      {needsSignIn ? (
        <Empty title="Sign in to see this feed" action={<button type="button" className="btn btn-primary" onClick={() => openOnboarding("signin")}>Sign in</button>}>
          This feed is built from the people you follow.
        </Empty>
      ) : (
        <>
          <NoteList events={visible} />
          {loading && <FeedSkeleton count={visible.length ? 1 : 4} />}
          {loadedOnce && !loading && !visible.length && (
            <Empty title={error ? "Couldn't load this feed" : "Nothing here yet"}>{error ?? (feed.src === "following" ? "Follow a few people and their notes will show up here." : "Notes from this feed will show up here.")}</Empty>
          )}
          {done && visible.length > 0 && <Endcap>You're all caught up</Endcap>}
        </>
      )}
    </>
  );
}

export function Home() {
  const feeds = useSettings((s) => s.feeds);
  const activeId = useSettings((s) => s.activeFeed);
  const set = useSettings((s) => s.set);
  const feed = feeds.find((f) => f.id === activeId) ?? feeds[0];
  const me = useActivePubkey();
  const spec = useMemo(() => feedSpec(feed, me), [feed, me]);
  const { timeline } = useTimeline(spec);
  const step = (d: 1 | -1) => {
    const i = feeds.findIndex((f) => f.id === feed.id);
    const next = feeds[(i + d + feeds.length) % feeds.length];
    set({ activeFeed: next.id });
  };
  return (
    <Screen
      title={<span className="md:hidden">Dusk</span>}
      titleNode={
        <h1 className="min-w-0 flex-1 truncate text-xl leading-[26px] font-semibold">
          <span className="md:hidden">Dusk</span>
          <span className="hidden md:inline">{feed.name}</span>
        </h1>
      }
      fab
      scrollKey={"home:" + feed.id}
      onTopbarSwipe={step}
      onRefresh={() => timeline?.refresh()}
      onEnd={() => timeline?.loadMore()}
      actions={
        <button type="button" className="iconbtn" aria-label="Refresh" onClick={() => timeline?.refresh()}>
          <Icon name="refresh" />
        </button>
      }
      sub={
        <Chips label="Feeds">
          {feeds.map((f) => (
            <button key={f.id} type="button" role="tab" className="chip" aria-selected={f.id === feed.id} onClick={() => set({ activeFeed: f.id })}>
              {f.name}
            </button>
          ))}
          <button type="button" className="chip" aria-label="Add a feed" onClick={openFeedAdd}>
            <Icon name="plus" size={18} />
          </button>
        </Chips>
      }
    >
      <FeedView key={feed.id + (me ?? "")} feed={feed} />
    </Screen>
  );
}

export function openFeedAdd() {
  openSheet(<FeedAdd />, { label: "Add a feed" });
}

function FeedAdd() {
  const me = useActivePubkey();
  const feeds = useSettings((s) => s.feeds);
  const set = useSettings((s) => s.set);
  const [src, setSrc] = useState<FeedSource>("tag");
  const [value, setValue] = useState("");
  const sets = use$(() => (me ? eventStore.timeline({ kinds: [30000], authors: [me] }) : undefined), [me]) ?? [];
  const add = () => {
    let f: Feed;
    const id = Math.random().toString(36).slice(2, 8);
    if (src === "tag") {
      const tag = value.trim().replace(/^#/, "").toLowerCase();
      if (!tag) return;
      f = { id, name: "#" + tag, src, tag };
    } else if (src === "relay") {
      const r = normalizeRelay(value);
      if (!r) return toast("That isn't a server address");
      f = { id, name: r.replace(/^wss?:\/\//, ""), src, relay: r };
    } else if (src === "set") {
      const ev = sets.find((s) => s.tags.find((t) => t[0] === "d")?.[1] === value);
      if (!ev) return;
      f = { id, name: ev.tags.find((t) => t[0] === "title")?.[1] ?? value, src, set: value };
    } else f = { id, name: SOURCES[src].replace(" from people you follow", ""), src };
    set({ feeds: [...feeds, f], activeFeed: f.id });
    closeSheet();
  };
  const opts: FeedSource[] = ["tag", "relay", "set", "following", "fof", "global", "long", "pictures", "video"];
  return (
    <div className="grid gap-3">
      <h2 className="text-xl font-semibold">Add a feed</h2>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {opts.map((o) => (
          <button key={o} type="button" role="radio" className="chip" aria-checked={src === o} onClick={() => (setSrc(o), setValue(""))}>
            {SOURCES[o]}
          </button>
        ))}
      </div>
      {src === "tag" && (
        <Field label="Hashtag">
          <input className="field" autoFocus placeholder="#photography" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        </Field>
      )}
      {src === "relay" && (
        <Field label="Server address">
          <input className="field key" autoFocus placeholder="wss://relay.example.com" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        </Field>
      )}
      {src === "set" &&
        (sets.length ? (
          <div className="flex flex-wrap gap-2">
            {sets.map((s) => {
              const d = s.tags.find((t) => t[0] === "d")?.[1] ?? "";
              return (
                <button key={s.id} type="button" className="chip" aria-checked={value === d} role="radio" onClick={() => setValue(d)}>
                  {s.tags.find((t) => t[0] === "title")?.[1] ?? d}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="caption">You have no lists yet. Make one from someone's profile.</p>
        ))}
      <button type="button" className="btn btn-primary btn-lg" onClick={add}>
        Add feed
      </button>
    </div>
  );
}
