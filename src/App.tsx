import { useEffect } from "react";
import { HashRouter, Routes, Route, Outlet, useNavigate, Navigate, useParams } from "react-router";
import { useSettings } from "./state/settings";
import { useActivePubkey } from "./state/accounts";
import { useSession } from "./nostr/session";
import { useNotificationFeed } from "./nostr/notifications";
import { useDMFeed } from "./nostr/dms";
import { loadWallet } from "./nostr/zaps";
import { SheetHost, Toasts, Lightbox } from "./ui/Overlays";
import { dropLockedAccounts } from "./state/accounts";
import { toast } from "./state/ui";
import { openOnboarding } from "./screens/Onboarding";
import { Rail, TabBar } from "./ui/Nav";
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
      {onboarding && <Onboarding />}
    </HashRouter>
  );
}

export { openShortcuts };
