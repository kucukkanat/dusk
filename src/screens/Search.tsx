import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { queryProfile } from "nostr-tools/nip05";
import { searchLocalProfiles, searchRelays, trendingTags } from "../nostr/search";
import { friendsOfFriends } from "../nostr/feeds";
import { useActivePubkey } from "../state/accounts";
import { useFollowing, useMyMutes, isMuted } from "../nostr/lists";
import { pathFor, tagPath } from "../lib/links";
import { Screen } from "../ui/Screen";
import { Empty, Spinner } from "../ui/primitives";
import { PersonRow } from "../ui/PersonRow";
import { NoteList } from "../note/NoteCard";
import { Icon } from "../ui/Icon";
import { openShortcuts } from "./Shortcuts";

function SearchBox({ value, onChange, onSubmit, autoFocus, id }: { value: string; onChange: (v: string) => void; onSubmit?: () => void; autoFocus?: boolean; id?: string }) {
  return (
    <form
      className="min-w-0 flex-1"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <label className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-muted focus-within:border-line-strong">
        <Icon name="search" size={20} />
        <span className="sr-only">Search</span>
        <input id={id} type="search" autoFocus={autoFocus} autoComplete="off" className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none" placeholder="Search people, notes and #tags" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </form>
  );
}

function TagRow({ tag, n }: { tag: string; n?: number }) {
  return (
    <Link to={tagPath(tag)} className="flex items-center gap-3 bg-surface px-4 py-3 hover:bg-wash">
      <span className="grid size-10 place-items-center rounded-full bg-raised text-muted">
        <Icon name="hash" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">#{tag}</b>
        {n != null && <span className="text-[13px] text-muted">{n} people posting</span>}
      </span>
      <Icon name="chev" className="text-subtle" size={18} />
    </Link>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="px-4 pt-6 pb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">{children}</div>;
}

function useSuggestions(limit = 6) {
  const me = useActivePubkey();
  const follows = useFollowing(me);
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    if (!me) return;
    friendsOfFriends(me, 40).then((l) => setList(l));
  }, [me]);
  return list.filter((p) => !follows.has(p)).slice(0, limit);
}

function useTrending() {
  const [tags, setTags] = useState(() => trendingTags(8));
  useEffect(() => {
    const t = setInterval(() => setTags(trendingTags(8)), 15000);
    const first = setTimeout(() => setTags(trendingTags(8)), 3000);
    return () => (clearInterval(t), clearTimeout(first));
  }, []);
  return tags;
}

function Results({ q }: { q: string }) {
  const nav = useNavigate();
  const mutes = useMyMutes();
  const [people, setPeople] = useState<string[]>([]);
  const [notes, setNotes] = useState<NostrEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const query = q.trim();
  const direct = useMemo(() => pathFor(query), [query]);
  const isTag = query.startsWith("#");
  const isNip05 = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(query);

  useEffect(() => {
    if (direct) nav(direct);
  }, [direct, nav]);

  useEffect(() => {
    if (!query || direct) return;
    let alive = true;
    setPeople(searchLocalProfiles(query, 8));
    setNotes([]);
    setLoading(true);
    const t = setTimeout(async () => {
      if (isNip05) {
        const r = await queryProfile(query).catch(() => null);
        if (alive && r) setPeople((p) => [r.pubkey, ...p.filter((x) => x !== r.pubkey)]);
      }
      if (isTag) {
        setLoading(false);
        return;
      }
      const [profiles, found] = await Promise.all([searchRelays(query, [0], 20), searchRelays(query, [1, 20, 1068, 30023], 40)]);
      if (!alive) return;
      setPeople((p) => [...new Set([...p, ...profiles.map((e) => e.pubkey)])].slice(0, 12));
      setNotes(found.sort((a, b) => b.created_at - a.created_at));
      setLoading(false);
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, direct, isNip05, isTag]);

  const visibleNotes = notes.filter((n) => !isMuted(n, mutes));
  const tag = query.replace(/^#/, "").split(/\s/)[0].toLowerCase();
  return (
    <>
      {tag && /^[\p{L}\p{N}_-]+$/u.test(tag) && (
        <>
          <Label>Tags</Label>
          <TagRow tag={tag} />
        </>
      )}
      {people.length > 0 && (
        <>
          <Label>People</Label>
          <div className="[&>*+*]:border-t [&>*+*]:border-line">
            {people.map((p) => (
              <PersonRow key={p} pubkey={p} />
            ))}
          </div>
        </>
      )}
      {visibleNotes.length > 0 && (
        <>
          <Label>Notes</Label>
          <NoteList events={visibleNotes} />
        </>
      )}
      {loading && <Spinner />}
      {!loading && !people.length && !visibleNotes.length && !tag && <Empty title="No results">Nothing matches “{query}”. Try a name, an address like name@domain.com, or a #tag.</Empty>}
    </>
  );
}

export function Search() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [submitted, setSubmitted] = useState(params.get("q") ?? "");
  useEffect(() => {
    const t = setTimeout(() => {
      setSubmitted(q);
      setParams(q ? { q } : {}, { replace: true });
    }, 400);
    return () => clearTimeout(t);
  }, [q, setParams]);
  return (
    <Screen titleNode={<SearchBox value={q} onChange={setQ} onSubmit={() => setSubmitted(q)} autoFocus={!q} />} fab scrollKey="search">
      {submitted.trim() ? <Results q={submitted} /> : <Browse />}
    </Screen>
  );
}

function Browse() {
  const tags = useTrending();
  const sugg = useSuggestions(6);
  return (
    <>
      {tags.length > 0 && (
        <>
          <Label>Trending in your feeds</Label>
          <div className="[&>*+*]:border-t [&>*+*]:border-line">
            {tags.map((t) => (
              <TagRow key={t.tag} tag={t.tag} n={t.n} />
            ))}
          </div>
        </>
      )}
      {sugg.length > 0 && (
        <>
          <Label>People you might like</Label>
          <div className="[&>*+*]:border-t [&>*+*]:border-line">
            {sugg.map((p) => (
              <PersonRow key={p} pubkey={p} />
            ))}
          </div>
        </>
      )}
      {!tags.length && !sugg.length && <Empty title="Find people and notes">Search by name, address (name@domain.com), npub, or #tag.</Empty>}
    </>
  );
}

/** The right-hand column on wide screens. */
export function Discover() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const tags = useTrending().slice(0, 5);
  const sugg = useSuggestions(3);
  return (
    <div className="h-full overflow-y-auto px-4 py-5">
      <SearchBox id="discover-q" value={q} onChange={setQ} onSubmit={() => q.trim() && nav("/search?q=" + encodeURIComponent(q.trim()))} />
      {tags.length > 0 && (
        <section className="mt-4 overflow-hidden rounded-[14px] border border-line bg-surface">
          <h2 className="px-4 pt-4 pb-2 text-[17px] font-semibold">Trending</h2>
          {tags.map((t) => (
            <TagRow key={t.tag} tag={t.tag} n={t.n} />
          ))}
        </section>
      )}
      {sugg.length > 0 && (
        <section className="mt-4 overflow-hidden rounded-[14px] border border-line bg-surface">
          <h2 className="px-4 pt-4 pb-2 text-[17px] font-semibold">Who to follow</h2>
          {sugg.map((p) => (
            <PersonRow key={p} pubkey={p} />
          ))}
        </section>
      )}
      <p className="mt-4 px-1 text-[13px] text-muted">
        Press{" "}
        <button type="button" className="rounded border border-line px-1.5 font-mono text-[12px]" onClick={openShortcuts}>
          ?
        </button>{" "}
        for keyboard shortcuts.
      </p>
    </div>
  );
}
