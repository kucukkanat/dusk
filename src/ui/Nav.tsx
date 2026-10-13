import { useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { use$ } from "applesauce-react/hooks";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { eventStore } from "../nostr/core";
import { useActivePubkey, useAccounts } from "../state/accounts";
import { useSettings } from "../state/settings";
import { openSheet } from "../state/ui";
import { openCompose } from "../sheets/Compose";
import { useHasUnreadActivity } from "../nostr/notifications";
import { useConversations } from "../nostr/dms";
import { useFollowing } from "../nostr/lists";
import { Icon, type IconName } from "./Icon";
import { Avatar } from "./primitives";
import { Slider } from "./Slider";

export type NavItem = { id: string; to: string; icon: IconName; label: string; end?: boolean };

export const NAV_ITEMS: Record<string, NavItem> = {
  home: { id: "home", to: "/", icon: "home", label: "Home", end: true },
  search: { id: "search", to: "/search", icon: "search", label: "Search" },
  activity: { id: "activity", to: "/activity", icon: "bell", label: "Activity" },
  messages: { id: "messages", to: "/messages", icon: "message", label: "Messages" },
  me: { id: "me", to: "/me", icon: "user", label: "You" },
  bookmarks: { id: "bookmarks", to: "/bookmarks", icon: "bookmark", label: "Bookmarks" },
  lists: { id: "lists", to: "/lists", icon: "list", label: "Lists" },
  drafts: { id: "drafts", to: "/drafts", icon: "draft", label: "Drafts" },
  settings: { id: "settings", to: "/settings", icon: "settings", label: "Settings" },
};

const DOCK = ["home", "search", "activity", "messages", "me"];

function useDots() {
  const me = useActivePubkey();
  const activity = useHasUnreadActivity();
  const follows = useFollowing(me);
  const convs = useConversations(follows);
  return { activity, messages: convs.some((c) => c.unread > 0 && !c.isRequest) } as Record<string, boolean>;
}

/** The nav item a path belongs to. */
function activeId(path: string, ids: string[]) {
  let best = "";
  for (const id of ids) {
    const to = NAV_ITEMS[id]?.to;
    if (!to) continue;
    const hit = to === "/" ? path === "/" : path === to || path.startsWith(to + "/");
    if (hit && to.length > (NAV_ITEMS[best]?.to.length ?? -1)) best = id;
  }
  if (!best && path.startsWith("/settings")) best = "settings";
  return best;
}

function useMyLists(): NostrEvent[] {
  const me = useActivePubkey();
  return use$(() => (me ? eventStore.timeline({ kinds: [30000, 39089], authors: [me] }) : undefined), [me]) ?? [];
}

const titleOf = (e: NostrEvent) => e.tags.find((t) => t[0] === "title")?.[1] || e.tags.find((t) => t[0] === "d")?.[1] || "List";
const dOf = (e: NostrEvent) => e.tags.find((t) => t[0] === "d")?.[1] ?? "";

export function Rail() {
  const me = useActivePubkey();
  const dots = useDots();
  const accounts = useAccounts((s) => s.accounts);
  const rail = useSettings((s) => s.rail);
  const feeds = useSettings((s) => s.feeds);
  const activeFeed = useSettings((s) => s.activeFeed);
  const set = useSettings((s) => s.set);
  const loc = useLocation();
  const nav = useNavigate();
  const lists = useMyLists().filter((e) => e.kind === 30000 || e.kind === 39089);
  const ref = useRef<HTMLDivElement>(null);
  const order = [...rail.order, ...Object.keys(NAV_ITEMS).filter((k) => !rail.order.includes(k))];
  const items = order.filter((id) => NAV_ITEMS[id] && !rail.hidden.includes(id));
  const currentFeed = feeds.find((f) => f.id === activeFeed);
  const activeList = loc.pathname === "/" && currentFeed?.src === "set" ? currentFeed.set : undefined;
  const active = activeList ? "" : activeId(loc.pathname, items);

  const openList = (e: NostrEvent) => {
    const d = dOf(e);
    let f = feeds.find((x) => x.src === "set" && x.set === d);
    if (!f) {
      f = { id: "set-" + d, name: titleOf(e), src: "set", set: d };
      set({ feeds: [...feeds, f] });
    }
    set({ activeFeed: f.id });
    nav("/");
  };

  const rowCls = (on: boolean) => `relative z-[1] flex min-h-12 items-center justify-center gap-3 rounded-full text-[15px] font-medium transition-colors xl:justify-start xl:px-4 ${on ? "text-ink" : "text-muted hover:text-ink"}`;

  return (
    <nav className="hidden min-h-0 flex-col overflow-y-auto border-r border-line px-3 py-5 md:flex" aria-label="Main">
      <div className="flex items-center justify-center gap-2 pb-4 text-xl font-semibold xl:justify-start xl:px-4">
        <span className="size-[22px] flex-none rounded-full bg-[linear-gradient(180deg,var(--lilac)_0_46%,var(--peach)_46%_62%,var(--mist)_62%)]" />
        <span className="hidden xl:inline">Dusk</span>
      </div>
      <div ref={ref} className="relative flex flex-col gap-1">
        <Slider container={ref} selector='[data-active="true"]' deps={[active, activeList, items.join(), lists.length]} className="rounded-[24px] bg-wash" />
        {items.map((id) => {
          const it = NAV_ITEMS[id];
          const on = id === active;
          return (
            <NavLink key={id} to={it.to} end={it.end} data-active={on} className={rowCls(on)} aria-label={it.label}>
              <Icon name={it.icon} />
              <span className="hidden xl:inline">{it.label}</span>
              {dots[id] && <span className="absolute top-3 right-2.5 size-2 rounded-full bg-lilac-ink xl:right-auto xl:left-8" />}
            </NavLink>
          );
        })}
        {me && rail.lists && lists.length > 0 && (
          <>
            <div className="mt-4 mb-1 hidden px-4 text-[12px] font-semibold tracking-wide text-subtle uppercase xl:block">Your lists</div>
            <div className="mx-auto my-2 h-px w-8 bg-line xl:hidden" />
            {lists.map((e) => {
              const on = activeList === dOf(e);
              const title = titleOf(e);
              return (
                <button key={e.id} type="button" data-active={on} className={rowCls(on)} onClick={() => openList(e)} aria-label={`List: ${title}`} title={title}>
                  <span className="grid size-[22px] flex-none place-items-center rounded-full border border-line-strong text-[11px] font-semibold uppercase">{[...title][0]}</span>
                  <span className="hidden min-w-0 truncate xl:inline">{title}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
      <button type="button" className="btn btn-primary mt-4 px-0 xl:px-5" aria-label="New note" onClick={() => openCompose({})}>
        <Icon name="plus" />
        <span className="hidden xl:inline">New note</span>
      </button>
      <div className="mt-auto flex flex-col gap-1 pt-4">
        <button type="button" className="flex min-h-10 items-center justify-center gap-3 rounded-full text-[14px] text-subtle hover:text-ink xl:justify-start xl:px-4" onClick={openEditRail} aria-label="Edit sidebar">
          <Icon name="edit" size={18} />
          <span className="hidden xl:inline">Edit sidebar</span>
        </button>
        {me ? (
          <NavLink to="/identities" className="flex min-h-12 items-center justify-center gap-2 rounded-full hover:bg-wash xl:justify-start xl:px-3" aria-label="Identities">
            <Avatar pubkey={me} size="sm" />
            <span className="hidden min-w-0 flex-1 truncate text-[14px] text-muted xl:inline">{accounts.length > 1 ? `${accounts.length} identities` : "Identities"}</span>
          </NavLink>
        ) : (
          <NavLink to="/identities" className="flex min-h-12 items-center justify-center gap-2 rounded-full text-muted hover:bg-wash xl:justify-start xl:px-4">
            <Icon name="key" />
            <span className="hidden xl:inline">Sign in</span>
          </NavLink>
        )}
      </div>
    </nav>
  );
}

export function TabBar() {
  const dots = useDots();
  const loc = useLocation();
  const ref = useRef<HTMLElement>(null);
  const active = activeId(loc.pathname, DOCK);
  if (/^\/messages\/.+/.test(loc.pathname)) return null;
  return (
    <nav ref={ref} className="relative z-20 flex h-[calc(64px+env(safe-area-inset-bottom))] border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
      <Slider container={ref} selector='[data-active="true"] [data-pill]' deps={[active]} className="rounded-full bg-accent" />
      {DOCK.map((id) => {
        const it = NAV_ITEMS[id];
        const on = id === active;
        return (
          <NavLink key={id} to={it.to} end={it.end} data-active={on} className={`relative z-[1] flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] leading-[14px] font-semibold tracking-wide ${on ? "text-ink" : "text-muted"}`}>
            <span data-pill className={`grid h-[30px] w-14 place-items-center rounded-full transition-colors duration-300 ${on ? "text-on-accent" : ""}`}>
              <Icon name={it.icon} />
            </span>
            {it.label}
            {dots[id] && <span className="absolute top-2 left-[calc(50%+12px)] size-2 rounded-full bg-lilac shadow-[0_0_0_2px_var(--surface)]" />}
          </NavLink>
        );
      })}
    </nav>
  );
}

/* ---------- editing the sidebar ---------- */

export function openEditRail() {
  openSheet(<EditRail />, { label: "Edit sidebar" });
}

function EditRail() {
  const rail = useSettings((s) => s.rail);
  const set = useSettings((s) => s.set);
  const order = [...rail.order, ...Object.keys(NAV_ITEMS).filter((k) => !rail.order.includes(k))].filter((k) => NAV_ITEMS[k]);
  const save = (patch: Partial<typeof rail>) => set({ rail: { ...rail, order, ...patch } });
  const move = (i: number, d: number) => {
    const next = [...order];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    save({ order: next });
  };
  const toggle = (id: string, on: boolean) => save({ hidden: on ? rail.hidden.filter((h) => h !== id) : [...rail.hidden, id] });
  return (
    <div className="grid gap-3">
      <h2 className="text-xl font-semibold">Edit sidebar</h2>
      <p className="caption">Choose what shows in the sidebar on wider screens, and in what order. Home always stays.</p>
      <div className="overflow-hidden rounded-[14px] border border-line [&>*+*]:border-t [&>*+*]:border-line">
        {order.map((id, i) => {
          const it = NAV_ITEMS[id];
          const shown = !rail.hidden.includes(id);
          return (
            <div key={id} className="flex items-center gap-2 bg-surface px-3 py-2">
              <Icon name={it.icon} className={shown ? "" : "text-subtle"} />
              <span className={`flex-1 text-[15px] font-medium ${shown ? "" : "text-subtle"}`}>{it.label}</span>
              <button type="button" className="iconbtn" aria-label={`Move ${it.label} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                <Icon name="up" />
              </button>
              <button type="button" className="iconbtn" aria-label={`Move ${it.label} down`} disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                <Icon name="down" />
              </button>
              <input type="checkbox" className="toggle" aria-label={`Show ${it.label}`} checked={shown} disabled={id === "home"} onChange={(e) => toggle(id, e.target.checked)} />
            </div>
          );
        })}
      </div>
      <label className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-surface px-3 py-2">
        <span>
          <b className="block text-[15px]">Show your lists</b>
          <span className="caption">Open a list as a feed in one click</span>
        </span>
        <input type="checkbox" className="toggle" checked={rail.lists} onChange={(e) => save({ lists: e.target.checked })} />
      </label>
      <button type="button" className="btn btn-ghost" onClick={() => set({ rail: { order: Object.keys(NAV_ITEMS), hidden: ["drafts"], lists: true } })}>
        Reset to default
      </button>
    </div>
  );
}
