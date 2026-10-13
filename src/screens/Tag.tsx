import { useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { useSettings } from "../state/settings";
import { hashtagSpec } from "../nostr/feeds";
import { useTimeline } from "../nostr/timeline";
import { useMyMutes, isMuted, setMute } from "../nostr/lists";
import { Screen } from "../ui/Screen";
import { NoteList } from "../note/NoteCard";
import { Empty, Endcap, FeedSkeleton } from "../ui/primitives";
import { Icon } from "../ui/Icon";
import { requireSignIn } from "../note/actions";
import { toast } from "../state/ui";

export function Tag() {
  const { tag: raw = "" } = useParams();
  const tag = decodeURIComponent(raw).toLowerCase();
  const nav = useNavigate();
  const feeds = useSettings((s) => s.feeds);
  const set = useSettings((s) => s.set);
  const saved = feeds.find((f) => f.src === "tag" && f.tag === tag);
  const spec = useMemo(() => hashtagSpec(tag), [tag]);
  const { events, loading, loadedOnce, done, timeline } = useTimeline(spec);
  const mutes = useMyMutes();
  const visible = events.filter((e) => !isMuted(e, mutes));
  const mutedTag = mutes.hashtags.has(tag);
  return (
    <Screen
      back
      title={"#" + tag}
      fab
      onEnd={() => timeline?.loadMore()}
      onRefresh={() => timeline?.refresh()}
      actions={
        <>
          {saved ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => (set({ activeFeed: saved.id }), nav("/"))}>
              In your feeds
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const id = "t-" + tag;
                set({ feeds: [...feeds, { id, name: "#" + tag, src: "tag", tag }] });
                toast("Saved to your feeds");
              }}
            >
              <Icon name="plus" size={18} />
              Save as feed
            </button>
          )}
          <button type="button" className="iconbtn" aria-label={mutedTag ? "Unmute tag" : "Mute tag"} onClick={() => requireSignIn() && setMute("tag", tag, !mutedTag).then(() => toast(mutedTag ? "Unmuted #" + tag : "Muted #" + tag))}>
            <Icon name={mutedTag ? "eye" : "mute"} />
          </button>
        </>
      }
    >
      <NoteList events={visible} />
      {loading && <FeedSkeleton />}
      {loadedOnce && !loading && !visible.length && <Empty title="No notes yet">Nobody on your servers has used #{tag} recently.</Empty>}
      {done && visible.length > 0 && <Endcap>That's all for #{tag}</Endcap>}
    </Screen>
  );
}
