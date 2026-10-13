import { useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { use$ } from "applesauce-react/hooks";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { eventStore } from "../nostr/core";
import { useActivePubkey, useAccounts } from "../state/accounts";
import { useSettings } from "../state/settings";
import { openSheet, closeSheet, replaceSheet } from "../state/ui";
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

/** Open one of your lists as a feed (adding the feed if needed). */
function useOpenList() {
  const feeds = useSettings((s) => s.feeds);
  const set = useSettings((s) => s.set);
  const nav = useNavigate();
  return (e: NostrEvent) => {
    const d = dOf(e);
    let f = feeds.find((x) => x.src === "set" && x.set === d);
    if (!f) {
      f = { id: "set-" + d, name: titleOf(e), src: "set", set: d };
      set({ feeds: [...feeds, f] });
    }
    set({ activeFeed: f.id });
    nav("/");
  };
}

/** Tapping the tab you're already on scrolls it back to the top, like native apps. */
const scrollToTop = () => document.querySelector("main [data-scroller]")?.scrollTo({ top: 0, behavior: "smooth" });

const fullOrder = (order: string[]) => [...order, ...Object.keys(NAV_ITEMS).filter((k) => !order.includes(k))].filter((k) => NAV_ITEMS[k]);

export function Rail() {
  const me = useActivePubkey();
  const dots = useDots();
  const accounts = useAccounts((s) => s.accounts);
  const rail = useSettings((s) => s.rail);
  const feeds = useSettings((s) => s.feeds);
  const activeFeed = useSettings((s) => s.activeFeed);
  const loc = useLocation();
  const lists = useMyLists().filter((e) => e.kind === 30000 || e.kind === 39089);
  const ref = useRef<HTMLDivElement>(null);
  const order = [...rail.order, ...Object.keys(NAV_ITEMS).filter((k) => !rail.order.includes(k))];
  const items = order.filter((id) => NAV_ITEMS[id] && !rail.hidden.includes(id));
  const currentFeed = feeds.find((f) => f.id === activeFeed);
  const activeList = loc.pathname === "/" && currentFeed?.src === "set" ? currentFeed.set : undefined;
  const active = activeList ? "" : activeId(loc.pathname, items);

  const openList = useOpenList();

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
            <NavLink key={id} to={it.to} end={it.end} data-active={on} className={rowCls(on)} aria-label={it.label} onClick={() => on && loc.pathname === it.to && scrollToTop()}>
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
  const dock = useSettings((s) => s.dock);
  const order = fullOrder(dock.order);
  const shown = order.slice(0, 4);
  const more = order.slice(4);
  const hit = activeId(loc.pathname, order);
  const active = shown.includes(hit) ? hit : hit ? "more" : "";
  if (/^\/messages\/.+/.test(loc.pathname)) return null;
  const tab = (on: boolean) => `relative z-[1] flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] leading-[14px] font-semibold tracking-wide ${on ? "text-ink" : "text-muted"}`;
  const pill = (on: boolean) => `grid h-[30px] w-14 place-items-center rounded-full transition-colors duration-300 ${on ? "text-on-accent" : ""}`;
  return (
    <nav ref={ref} className="relative z-20 flex h-[calc(64px+env(safe-area-inset-bottom))] border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
      <Slider container={ref} selector='[data-active="true"] [data-pill]' deps={[active, shown.join()]} className="rounded-full bg-accent" />
      {shown.map((id) => {
        const it = NAV_ITEMS[id];
        const on = id === active;
        return (
          <NavLink key={id} to={it.to} end={it.end} data-active={on} className={tab(on)} onClick={() => on && loc.pathname === it.to && scrollToTop()}>
            <span data-pill className={pill(on)}>
              <Icon name={it.icon} />
            </span>
            {it.label}
            {dots[id] && <span className="absolute top-2 left-[calc(50%+12px)] size-2 rounded-full bg-lilac shadow-[0_0_0_2px_var(--surface)]" />}
          </NavLink>
        );
      })}
      <button type="button" data-active={active === "more"} className={tab(active === "more")} aria-label="More" onClick={() => openSheet(<MoreDrawer items={more} />, { label: "More" })}>
        <span data-pill className={pill(active === "more")}>
          <Icon name="more" />
        </span>
        More
        {more.some((id) => dots[id]) && <span className="absolute top-2 left-[calc(50%+12px)] size-2 rounded-full bg-lilac shadow-[0_0_0_2px_var(--surface)]" />}
      </button>
    </nav>
  );
}

/** The rest of the menu on phones, opened from the dock's More button. */
function MoreDrawer({ items }: { items: string[] }) {
  const me = useActivePubkey();
  const dots = useDots();
  const loc = useLocation();
  const lists = useMyLists();
  const openList = useOpenList();
  const hit = activeId(loc.pathname, items);
  const row = "relative flex min-h-[52px] w-full items-center gap-3 rounded-[10px] px-3 text-left text-[15px] font-medium hover:bg-wash";
  return (
    <div className="grid gap-1">
      <h2 className="mb-1 text-xl font-semibold">More</h2>
      {items.map((id) => {
        const it = NAV_ITEMS[id];
        return (
          <NavLink key={id} to={it.to} end={it.end} className={`${row} ${hit === id ? "bg-wash" : ""}`} onClick={() => closeSheet()}>
            <Icon name={it.icon} className="text-muted" />
            {it.label}
            {dots[id] && <span className="size-2 rounded-full bg-lilac-ink" />}
          </NavLink>
        );
      })}
      {me && lists.length > 0 && (
        <>
          <div className="px-3 pt-3 pb-1 text-[12px] font-semibold tracking-wide text-subtle uppercase">Your lists</div>
          {lists.map((e) => (
            <button key={e.id} type="button" className={row} onClick={() => (closeSheet(), openList(e))}>
              <span className="grid size-[22px] flex-none place-items-center rounded-full border border-line-strong text-[11px] font-semibold uppercase">{[...titleOf(e)][0]}</span>
              <span className="min-w-0 truncate">{titleOf(e)}</span>
            </button>
          ))}
        </>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-3">
        <NavLink to="/identities" className="btn btn-secondary" onClick={() => closeSheet()}>
          <Icon name={me ? "people" : "key"} size={18} />
          {me ? "Identities" : "Sign in"}
        </NavLink>
        <button type="button" className="btn btn-secondary" onClick={() => replaceSheet(<EditNav initial="dock" />)}>
          <Icon name="edit" size={18} />
          Edit dock
        </button>
      </div>
    </div>
  );
}

/* ---------- editing the sidebar ---------- */

export function openEditRail() {
  openSheet(<EditNav initial="rail" />, { label: "Edit navigation" });
}

function EditNav({ initial }: { initial: "rail" | "dock" }) {
  const [mode, setMode] = useState(initial);
  const rail = useSettings((s) => s.rail);
  const dock = useSettings((s) => s.dock);
  const set = useSettings((s) => s.set);
  const isDock = mode === "dock";
  const order = fullOrder(isDock ? dock.order : rail.order);
  const save = (patch: Partial<typeof rail>) => {
    if (isDock) set({ dock: { order: patch.order ?? order } });
    else set({ rail: { ...rail, order, ...patch } });
  };
  const move = (i: number, d: number) => {
    const next = [...order];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    save({ order: next });
  };
  const toggle = (id: string, on: boolean) => save({ hidden: on ? rail.hidden.filter((h) => h !== id) : [...rail.hidden, id] });

  // drag and drop by the grip on the left (pointer events: works with mouse and touch)
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; y0: number; h: number } | null>(null);
  const onGripDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const h = rows.current[i]?.getBoundingClientRect().height ?? 52;
    setDrag({ from: i, to: i, dy: 0, y0: e.clientY, h });
  };
  const onGripMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const dy = e.clientY - drag.y0;
    const to = Math.max(0, Math.min(order.length - 1, drag.from + Math.round(dy / drag.h)));
    setDrag({ ...drag, dy, to });
  };
  const onGripUp = () => {
    if (!drag) return;
    if (drag.to !== drag.from) {
      const next = [...order];
      const [x] = next.splice(drag.from, 1);
      next.splice(drag.to, 0, x);
      save({ order: next });
      navigator.vibrate?.(8);
    }
    setDrag(null);
  };
  /** How far a row moves to make room for the one being dragged. */
  const shift = (i: number) => {
    if (!drag || i === drag.from) return 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.h;
    if (drag.from > drag.to && i < drag.from && i >= drag.to) return drag.h;
    return 0;
  };

  return (
    <div className="grid gap-3">
      <h2 className="text-xl font-semibold">Edit navigation</h2>
      <div className="flex gap-2" role="tablist">
        <button type="button" role="tab" className="chip" aria-selected={!isDock} onClick={() => setMode("rail")}>
          Sidebar
        </button>
        <button type="button" role="tab" className="chip" aria-selected={isDock} onClick={() => setMode("dock")}>
          Mobile dock
        </button>
      </div>
      <p className="caption">{isDock ? "The first four show in the dock on phones. The rest are one tap away under More." : "Choose what shows in the sidebar on wider screens, and in what order. Home always stays."}</p>
      <div className={`rounded-[14px] border border-line [&>*+*]:border-t [&>*+*]:border-line ${drag ? "select-none" : "overflow-hidden"}`}>
        {order.map((id, i) => {
          const it = NAV_ITEMS[id];
          const shown = isDock || !rail.hidden.includes(id);
          const dragging = drag?.from === i;
          return (
            <div
              key={id}
              ref={(el) => {
                rows.current[i] = el;
              }}
              className={`relative flex items-center gap-2 bg-surface py-2 pr-3 pl-1 ${dragging ? "z-10 rounded-[10px] shadow-[var(--shadow-sheet)] ring-1 ring-line-strong" : ""}`}
              style={{
                transform: `translateY(${dragging ? drag!.dy : shift(i)}px)${dragging ? " scale(1.02)" : ""}`,
                transition: dragging ? "box-shadow 120ms" : drag ? "transform 200ms var(--ease-calm)" : "none",
              }}
            >
              <span
                role="button"
                tabIndex={-1}
                aria-label={`Drag to reorder ${it.label}`}
                className={`grid h-10 w-8 flex-none touch-none place-items-center rounded-[8px] text-subtle hover:bg-wash hover:text-ink ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
                onPointerDown={onGripDown(i)}
                onPointerMove={onGripMove}
                onPointerUp={onGripUp}
                onPointerCancel={onGripUp}
              >
                <Icon name="grip" size={20} className="[stroke-width:2.5]" />
              </span>
              <Icon name={it.icon} className={shown ? "" : "text-subtle"} />
              <span className={`flex-1 text-[15px] font-medium ${shown ? "" : "text-subtle"}`}>{it.label}</span>
              <button type="button" className="iconbtn" aria-label={`Move ${it.label} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                <Icon name="up" />
              </button>
              <button type="button" className="iconbtn" aria-label={`Move ${it.label} down`} disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                <Icon name="down" />
              </button>
              {isDock ? (
                <span className={`w-[52px] text-center text-[12px] font-medium ${i < 4 ? "text-accent-ink" : "text-subtle"}`}>{i < 4 ? "Dock" : "More"}</span>
              ) : (
                <input type="checkbox" className="toggle" aria-label={`Show ${it.label}`} checked={shown} disabled={id === "home"} onChange={(e) => toggle(id, e.target.checked)} />
              )}
            </div>
          );
        })}
      </div>
      {!isDock && (
      <label className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-surface px-3 py-2">
        <span>
          <b className="block text-[15px]">Show your lists</b>
          <span className="caption">Open a list as a feed in one click</span>
        </span>
        <input type="checkbox" className="toggle" checked={rail.lists} onChange={(e) => save({ lists: e.target.checked })} />
      </label>
      )}
      <button type="button" className="btn btn-ghost" onClick={() => (isDock ? set({ dock: { order: Object.keys(NAV_ITEMS) } }) : set({ rail: { order: Object.keys(NAV_ITEMS), hidden: ["drafts"], lists: true } }))}>
        Reset to default
      </button>
    </div>
  );
}
