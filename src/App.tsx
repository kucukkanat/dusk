import { useEffect } from "react";
import { HashRouter, Routes, Route, NavLink, Outlet, useLocation, useNavigate, Navigate, useParams } from "react-router";
import { useSettings } from "./state/settings";
import { useActivePubkey, useAccounts } from "./state/accounts";
import { useSession } from "./nostr/session";
import { useNotificationFeed, useHasUnreadActivity } from "./nostr/notifications";
import { useDMFeed, useConversations } from "./nostr/dms";
import { useFollowing } from "./nostr/lists";
import { loadWallet } from "./nostr/zaps";
import { SheetHost, Toasts, Lightbox, UnlockPrompt } from "./ui/Overlays";
import { Icon, type IconName } from "./ui/Icon";
import { Avatar } from "./ui/primitives";
import { openCompose } from "./sheets/Compose";
import { Onboarding, useOnboarding } from "./screens/Onboarding";
import { Home } from "./screens/Home";
import { Thread } from "./screens/Thread";
import { Profile, Me } from "./screens/Profile";
import { Activity } from "./screens/Activity";
import { Messages, Chat } from "./screens/Messages";
import { Search, Discover } from "./screens/Search";
import { Tag } from "./screens/Tag";
import { Address } from "./screens/Address";
import { Settings } from "./screens/Settings";
import { Identities } from "./screens/Identities";
import { Bookmarks, Lists, Drafts } from "./screens/Lists";
import { pathFor } from "./lib/links";
import { openShortcuts, useShortcuts } from "./screens/Shortcuts";

function useApplySettings() {
  const s = useSettings();
  useEffect(() => {
    const r = document.documentElement;
    if (s.theme === "auto") r.removeAttribute("data-theme");
    else r.setAttribute("data-theme", s.theme);
    r.setAttribute("data-accent", s.accent);
    r.setAttribute("data-text", s.textSize);
    r.setAttribute("data-contrast", s.contrast);
    r.setAttribute("data-motion", s.reduceMotion ? "reduce" : "auto");
    const bg = getComputedStyle(r).getPropertyValue("--bg").trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg || "#14151a");
  }, [s.theme, s.accent, s.textSize, s.contrast, s.reduceMotion]);
}

const TABS: [string, IconName, string][] = [
  ["/", "home", "Home"],
  ["/search", "search", "Search"],
  ["/activity", "bell", "Activity"],
  ["/messages", "message", "Messages"],
  ["/me", "user", "You"],
];

function useDots() {
  const me = useActivePubkey();
  const activity = useHasUnreadActivity();
  const follows = useFollowing(me);
  const convs = useConversations(follows);
  const messages = convs.some((c) => c.unread > 0 && !c.isRequest);
  return { "/activity": activity, "/messages": messages } as Record<string, boolean>;
}

function Rail() {
  const me = useActivePubkey();
  const dots = useDots();
  const accounts = useAccounts((s) => s.accounts);
  return (
    <nav className="hidden min-h-0 flex-col gap-1 overflow-y-auto border-r border-line px-3 py-5 md:flex" aria-label="Main">
      <div className="flex items-center justify-center gap-2 pb-4 text-xl font-semibold xl:justify-start xl:px-4">
        <span className="size-[22px] flex-none rounded-full bg-[linear-gradient(180deg,var(--lilac)_0_46%,var(--peach)_46%_62%,var(--mist)_62%)]" />
        <span className="hidden xl:inline">Dusk</span>
      </div>
      {TABS.map(([to, icon, label]) => (
        <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `relative flex min-h-12 items-center justify-center gap-3 rounded-full text-[15px] font-medium xl:justify-start xl:px-4 ${isActive ? "bg-wash text-ink" : "text-muted hover:text-ink"}`} aria-label={label}>
          <Icon name={icon} />
          <span className="hidden xl:inline">{label}</span>
          {dots[to] && <span className="absolute top-3 right-2.5 size-2 rounded-full bg-lilac-ink xl:right-auto xl:left-8" />}
        </NavLink>
      ))}
      <button type="button" className="btn btn-primary mt-4 px-0 xl:px-5" aria-label="New note" onClick={() => openCompose({})}>
        <Icon name="plus" />
        <span className="hidden xl:inline">New note</span>
      </button>
      <div className="mt-auto pt-4">
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

function TabBar() {
  const dots = useDots();
  const loc = useLocation();
  const hide = /^\/messages\/.+/.test(loc.pathname);
  if (hide) return null;
  return (
    <nav className="relative z-20 flex h-[calc(64px+env(safe-area-inset-bottom))] border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
      {TABS.map(([to, icon, label]) => (
        <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] leading-[14px] font-semibold tracking-wide ${isActive ? "text-ink" : "text-muted"}`}>
          {({ isActive }) => (
            <>
              <span className={`grid h-[30px] w-14 place-items-center rounded-full transition-colors ${isActive ? "bg-accent text-on-accent" : ""}`}>
                <Icon name={icon} />
              </span>
              {label}
              {dots[to] && <span className="absolute top-2 left-[calc(50%+12px)] size-2 rounded-full bg-lilac shadow-[0_0_0_2px_var(--surface)]" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function Layout() {
  useShortcuts();
  return (
    <div className="fixed inset-0 grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] bg-bg md:grid-cols-[76px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,600px)_minmax(340px,420px)] xl:justify-center">
      <Rail />
      <main className="relative min-h-0 min-w-0 overflow-hidden md:border-r md:border-line">
        <Outlet />
      </main>
      <aside className="relative hidden min-h-0 min-w-0 overflow-hidden border-r border-line xl:block" aria-label="Discover">
        <Discover />
      </aside>
      <TabBar />
    </div>
  );
}

function OpenLink() {
  const { "*": rest } = useParams();
  const nav = useNavigate();
  useEffect(() => {
    const p = pathFor(rest ?? "");
    nav(p ?? "/", { replace: true });
  }, [rest, nav]);
  return null;
}

/** Handle the PWA share target (?text=...&url=...) by opening the composer. */
function useShareTarget() {
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const text = [q.get("title"), q.get("text"), q.get("url")].filter(Boolean).join("\n");
    if (text) {
      history.replaceState(null, "", location.pathname + location.hash);
      setTimeout(() => openCompose({ text }), 300);
    }
  }, []);
}

export default function App() {
  useApplySettings();
  useSession();
  useNotificationFeed();
  useDMFeed();
  useShareTarget();
  const me = useActivePubkey();
  useEffect(() => {
    loadWallet(me);
  }, [me]);
  const onboarding = useOnboarding();
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="search" element={<Search />} />
          <Route path="activity" element={<Activity />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:id" element={<Chat />} />
          <Route path="me" element={<Me />} />
          <Route path="p/:id" element={<Profile />} />
          <Route path="e/:id" element={<Thread />} />
          <Route path="a/:id" element={<Address />} />
          <Route path="t/:tag" element={<Tag />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/:section" element={<Settings />} />
          <Route path="identities" element={<Identities />} />
          <Route path="bookmarks" element={<Bookmarks />} />
          <Route path="lists" element={<Lists />} />
          <Route path="drafts" element={<Drafts />} />
          <Route path="open/*" element={<OpenLink />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <SheetHost />
      <Lightbox />
      <Toasts />
      <UnlockPrompt />
      {onboarding && <Onboarding />}
    </HashRouter>
  );
}

export { openShortcuts };
