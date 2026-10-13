import { lazy, Suspense, useEffect, useSyncExternalStore } from "react";
import { HashRouter, Routes, Route, Outlet, useNavigate, Navigate, useParams } from "react-router";
import { useShallow } from "zustand/react/shallow";
import { useSettings } from "./state/settings";
import { useActivePubkey } from "./state/accounts";
import { useSession } from "./nostr/session";
import { useNotificationFeed } from "./nostr/notifications";
import { useDMFeed } from "./nostr/dms";
import { loadWallet } from "./nostr/zaps";
import { SheetHost, Toasts, Lightbox } from "./ui/Overlays";
import { FeedSkeleton } from "./ui/primitives";
import { dropLockedAccounts } from "./state/accounts";
import { toast } from "./state/ui";
import { Rail, TabBar, useAppBadge } from "./ui/Nav";
import { openCompose } from "./sheets/Compose";
import { openOnboarding, useOnboarding } from "./state/onboarding";
import { Home } from "./screens/Home";
import { pathFor } from "./lib/links";
import { openShortcuts, useShortcuts } from "./screens/Shortcuts";

/** A screen file from an older build is gone after a deploy: reload once onto the new build. */
export function reloadForNewBuild() {
  try {
    if (sessionStorage.getItem("dusk.reloaded") === location.href) return;
    sessionStorage.setItem("dusk.reloaded", location.href);
  } catch {
    /* ignore */
  }
  location.reload();
}
const fresh = <T,>(f: () => Promise<T>) => () =>
  f().catch((e) => {
    reloadForNewBuild();
    throw e;
  });

// Home is the first paint; every other screen loads on first visit (or on idle, see preload).
const load = {
  thread: fresh(() => import("./screens/Thread")),
  profile: fresh(() => import("./screens/Profile")),
  activity: fresh(() => import("./screens/Activity")),
  messages: fresh(() => import("./screens/Messages")),
  search: fresh(() => import("./screens/Search")),
  tag: fresh(() => import("./screens/Tag")),
  address: fresh(() => import("./screens/Address")),
  settings: fresh(() => import("./screens/Settings")),
  identities: fresh(() => import("./screens/Identities")),
  lists: fresh(() => import("./screens/Lists")),
  onboarding: fresh(() => import("./screens/Onboarding")),
};
const Thread = lazy(() => load.thread().then((m) => ({ default: m.Thread })));
const Profile = lazy(() => load.profile().then((m) => ({ default: m.Profile })));
const Me = lazy(() => load.profile().then((m) => ({ default: m.Me })));
const Activity = lazy(() => load.activity().then((m) => ({ default: m.Activity })));
const Messages = lazy(() => load.messages().then((m) => ({ default: m.Messages })));
const Chat = lazy(() => load.messages().then((m) => ({ default: m.Chat })));
const Search = lazy(() => load.search().then((m) => ({ default: m.Search })));
const Discover = lazy(() => load.search().then((m) => ({ default: m.Discover })));
const Tag = lazy(() => load.tag().then((m) => ({ default: m.Tag })));
const Address = lazy(() => load.address().then((m) => ({ default: m.Address })));
const Settings = lazy(() => load.settings().then((m) => ({ default: m.Settings })));
const Identities = lazy(() => load.identities().then((m) => ({ default: m.Identities })));
const Bookmarks = lazy(() => load.lists().then((m) => ({ default: m.Bookmarks })));
const Lists = lazy(() => load.lists().then((m) => ({ default: m.Lists })));
const Drafts = lazy(() => load.lists().then((m) => ({ default: m.Drafts })));
const Onboarding = lazy(() => load.onboarding().then((m) => ({ default: m.Onboarding })));

/** Fetch the screens a tap is likely to open once the app is idle, so a morph (flushSync inside a view transition) never lands on a suspended screen. */
function usePreload() {
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
    idle(() => {
      for (const f of [load.thread, load.profile, load.search, load.activity, load.messages]) f().catch(() => {});
    });
  }, []);
}

function useApplySettings() {
  const s = useSettings(useShallow((s) => ({ theme: s.theme, accent: s.accent, textSize: s.textSize, contrast: s.contrast, reduceMotion: s.reduceMotion })));
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

// the Discover column only shows at xl; don't load or run it on phones
const wide = matchMedia("(min-width: 1100px)");
const useWide = () => useSyncExternalStore((cb) => (wide.addEventListener("change", cb), () => wide.removeEventListener("change", cb)), () => wide.matches);

function Layout() {
  useShortcuts();
  useAppBadge();
  const showDiscover = useWide();
  return (
    <div data-fill className="fixed inset-0 grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] bg-bg md:grid-cols-[76px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,600px)_minmax(340px,420px)] xl:justify-center">
      <Rail />
      <main className="relative min-h-0 min-w-0 overflow-hidden md:border-r md:border-line">
        <Suspense fallback={<FeedSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <aside className="relative hidden min-h-0 min-w-0 overflow-hidden border-r border-line xl:block" aria-label="Discover">
        {showDiscover && (
          <Suspense fallback={null}>
            <Discover />
          </Suspense>
        )}
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

/** Handle the PWA share target (?text=...&url=...) and the "New note" icon shortcut (?compose) by opening the composer. */
function useShareTarget() {
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const text = [q.get("title"), q.get("text"), q.get("url")].filter(Boolean).join("\n");
    if (text || q.has("compose")) {
      history.replaceState(null, "", location.pathname + location.hash);
      setTimeout(() => openCompose({ text }), 300);
    }
  }, []);
}

export default function App() {
  useApplySettings();
  // keys saved with a password by older builds can't be opened any more: ask to sign in again
  useEffect(() => {
    if (dropLockedAccounts()) {
      toast("Dusk no longer uses a password. Sign in again with your private key.", { ms: 8000 });
      openOnboarding("signin");
    }
  }, []);
  useSession();
  useNotificationFeed();
  useDMFeed();
  useShareTarget();
  usePreload();
  const me = useActivePubkey();
  useEffect(() => {
    loadWallet(me);
  }, [me]);
  const onboarding = useOnboarding();
  return (
    <HashRouter useTransitions={false}>
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
      {onboarding && (
        <Suspense fallback={null}>
          <Onboarding />
        </Suspense>
      )}
    </HashRouter>
  );
}

export { openShortcuts };
