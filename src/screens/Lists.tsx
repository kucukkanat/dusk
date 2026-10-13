import { useEffect, useState } from "react";
import { Link } from "react-router";
import { use$ } from "applesauce-react/hooks";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { eventStore, readRelays$, uniqRelays, DEFAULT_RELAYS } from "../nostr/core";
import { requestAll } from "../nostr/timeline";
import { useActivePubkey } from "../state/accounts";
import { useBookmarkList, createSet, useFollowing } from "../nostr/lists";
import { eventPath } from "../lib/links";
import { ago, plural } from "../lib/format";
import { errorToast, toast } from "../state/ui";
import { Screen, Chips } from "../ui/Screen";
import { Empty, Spinner, Avatar, Name } from "../ui/primitives";
import { NoteCard } from "../note/NoteCard";
import { Icon } from "../ui/Icon";
import { getDrafts, deleteDraft, openCompose, type Draft } from "../sheets/Compose";

function BookmarkItem({ pointer }: { pointer: string | { kind: number; pubkey: string; identifier: string } }) {
  const ev = use$(() => eventStore.event(pointer as never), [JSON.stringify(pointer)]);
  if (!ev) return <div className="flex items-center gap-2 bg-surface px-4 py-4 text-[14px] text-muted"><span className="spinner size-4" /> Loading…</div>;
  return <NoteCard event={ev} />;
}

export function Bookmarks() {
  const me = useActivePubkey();
  const pointers = useBookmarkList();
  return (
    <Screen back title="Bookmarks">
      {!me ? (
        <Empty title="Sign in to keep bookmarks" />
      ) : pointers.length ? (
        <div className="[&>*+*]:border-t [&>*+*]:border-line">
          {pointers.map((p) => (
            <BookmarkItem key={"id" in p ? p.id : `${p.kind}:${p.pubkey}:${p.identifier}`} pointer={"id" in p ? p.id : p} />
          ))}
        </div>
      ) : (
        <Empty title="No bookmarks">Long-press a note or swipe to bookmark it. Bookmarks are private.</Empty>
      )}
    </Screen>
  );
}

function ListCard({ e }: { e: NostrEvent }) {
  const title = e.tags.find((t) => t[0] === "title")?.[1] ?? e.tags.find((t) => t[0] === "d")?.[1] ?? "Untitled";
  const people = e.tags.filter((t) => t[0] === "p").map((t) => t[1]);
  return (
    <Link to={eventPath(e)} className="block bg-surface px-4 py-3 hover:bg-wash">
      <div className="flex items-center gap-2">
        <b className="min-w-0 flex-1 truncate text-[15px]">{title}</b>
        <span className="text-[13px] text-muted">{plural(people.length, "person", "people")}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[13px] text-muted">
        <Avatar pubkey={e.pubkey} size="xs" />
        <Name pubkey={e.pubkey} />· {ago(e.created_at)}
      </div>
      <div className="mt-2 flex -space-x-1.5">
        {people.slice(0, 10).map((p) => (
          <Avatar key={p} pubkey={p} size="sm" className="shadow-[0_0_0_2px_var(--surface)]" />
        ))}
      </div>
    </Link>
  );
}

export function Lists() {
  const me = useActivePubkey();
  const follows = useFollowing(me);
  const [tab, setTab] = useState<"mine" | "packs">(me ? "mine" : "packs");
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  useEffect(() => {
    setLoading(true);
    const authors = [...follows].slice(0, 300);
    const filters = tab === "mine" ? (me ? [{ kinds: [30000, 39089], authors: [me] }] : []) : authors.length ? [{ kinds: [39089], authors, limit: 100 }] : [{ kinds: [39089], limit: 60 }];
    if (!filters.length) return setLoading(false);
    requestAll(uniqRelays(readRelays$.value, DEFAULT_RELAYS, ["wss://purplepag.es"]), filters, 6000).then(() => setLoading(false));
  }, [tab, me, follows]);
  const mine = use$(() => (me ? eventStore.timeline({ kinds: [30000, 39089], authors: [me] }) : undefined), [me]) ?? [];
  const packs = use$(() => eventStore.timeline({ kinds: [39089] }), []) ?? [];
  const list = tab === "mine" ? mine : packs.filter((p) => p.pubkey !== me);
  return (
    <Screen
      back
      title="Lists"
      sub={
        <Chips>
          {me && (
            <button type="button" role="tab" className="chip" aria-selected={tab === "mine"} onClick={() => setTab("mine")}>
              Your lists
            </button>
          )}
          <button type="button" role="tab" className="chip" aria-selected={tab === "packs"} onClick={() => setTab("packs")}>
            Follow packs
          </button>
        </Chips>
      }
    >
      {tab === "mine" && me && (
        <form
          className="flex gap-2 px-4 py-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            try {
              await createSet(title.trim());
              setTitle("");
              toast("List created");
            } catch (er) {
              errorToast(er, "Couldn't create list");
            }
          }}
        >
          <input className="field min-h-11 py-2" placeholder="New list name" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="submit" className="btn btn-secondary" disabled={!title.trim()}>
            <Icon name="plus" size={18} />
            Create
          </button>
        </form>
      )}
      <div className="[&>*+*]:border-t [&>*+*]:border-line">
        {list.map((e) => (
          <ListCard key={e.id} e={e} />
        ))}
      </div>
      {loading && <Spinner />}
      {!loading && !list.length && <Empty title={tab === "mine" ? "No lists yet" : "No packs found"}>{tab === "mine" ? "Group people into lists from their profile, then add a list as a feed." : "Follow packs from people you follow show up here."}</Empty>}
    </Screen>
  );
}

export function Drafts() {
  const [drafts, setDrafts] = useState<Draft[]>(() => getDrafts());
  return (
    <Screen back title="Drafts">
      {drafts.length ? (
        <div className="[&>*+*]:border-t [&>*+*]:border-line">
          {drafts.map((d) => (
            <div key={d.id} className="flex items-start gap-3 bg-surface px-4 py-3">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openCompose({ draft: d })}>
                {d.replyTo && <span className="caption block">Reply</span>}
                <span className="line-clamp-3 block text-[15px]">{d.text}</span>
                <span className="caption block">{ago(d.t)}</span>
              </button>
              <button
                type="button"
                className="iconbtn"
                aria-label="Delete draft"
                onClick={() => {
                  deleteDraft(d.id);
                  setDrafts(getDrafts());
                }}
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No drafts">Notes you start and don't post are saved here.</Empty>
      )}
    </Screen>
  );
}
