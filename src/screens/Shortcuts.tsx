import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useUI, openSheet } from "../state/ui";
import { useSettings } from "../state/settings";
import { openCompose } from "../sheets/Compose";
import { openZap } from "../sheets/Zap";
import { eventStore } from "../nostr/core";
import { react, requireSignIn } from "../note/actions";
import { setBookmark } from "../nostr/lists";
import { eventPath } from "../lib/links";

const KEYS: [string, string][] = [
  ["j / k", "Next / previous note"],
  ["Enter", "Open the focused note"],
  ["l", "Like"],
  ["r", "Reply"],
  ["z", "Zap"],
  ["b", "Bookmark"],
  ["n", "New note"],
  ["/", "Search"],
  ["[ / ]", "Previous / next feed"],
  ["g h", "Home"],
  ["g a", "Activity"],
  ["g m", "Messages"],
  ["Esc", "Close or go back"],
  ["?", "This list"],
];

export function openShortcuts() {
  openSheet(
    <div className="grid gap-3">
      <h2 className="text-xl font-semibold">Keyboard shortcuts</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
        {KEYS.map(([k, d]) => (
          <div key={k} className="contents">
            <dt>
              <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[13px]">{k}</kbd>
            </dt>
            <dd className="text-muted">{d}</dd>
          </div>
        ))}
      </dl>
    </div>,
    { label: "Keyboard shortcuts" },
  );
}

export function useShortcuts() {
  const nav = useNavigate();
  useEffect(() => {
    let g = false;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.matches?.("input, textarea, select, [contenteditable]");
      if (e.key === "Escape") {
        if (useUI.getState().sheets.length || useUI.getState().lightbox) return;
        if (typing) return t.blur();
        if (location.hash.length > 2) history.back();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || useUI.getState().sheets.length) return;
      const notes = [...document.querySelectorAll<HTMLElement>("[data-screen] [data-note]")].filter((n) => n.offsetParent);
      const cur = document.activeElement instanceof HTMLElement && document.activeElement.dataset.note ? document.activeElement : null;
      const idx = cur ? notes.indexOf(cur) : -1;
      const ev = cur ? eventStore.getEvent(cur.dataset.note!) : undefined;
      if (g) {
        g = false;
        if (e.key === "h") nav("/");
        if (e.key === "a") nav("/activity");
        if (e.key === "m") nav("/messages");
        if (e.key === "p") nav("/me");
        return;
      }
      switch (e.key) {
        case "g":
          g = true;
          setTimeout(() => (g = false), 800);
          return;
        case "j":
        case "k": {
          e.preventDefault();
          const n = notes[Math.max(0, Math.min(notes.length - 1, idx < 0 ? 0 : idx + (e.key === "j" ? 1 : -1)))];
          n?.focus();
          n?.scrollIntoView({ block: "nearest" });
          return;
        }
        case "Enter":
          if (ev && cur === t) nav(eventPath(ev));
          return;
        case "l":
          if (ev && requireSignIn()) react(ev);
          return;
        case "r":
          if (ev && requireSignIn()) openCompose({ replyTo: ev });
          return;
        case "z":
          if (ev && requireSignIn()) openZap({ pubkey: ev.pubkey, event: ev });
          return;
        case "b":
          if (ev && requireSignIn()) setBookmark(ev, true);
          return;
        case "n":
          e.preventDefault();
          if (requireSignIn()) openCompose({});
          return;
        case "/": {
          e.preventDefault();
          const d = document.getElementById("discover-q");
          if (d && d.offsetParent) d.focus();
          else nav("/search");
          return;
        }
        case "[":
        case "]": {
          const s = useSettings.getState();
          const i = s.feeds.findIndex((f) => f.id === s.activeFeed);
          const next = s.feeds[(i + (e.key === "]" ? 1 : -1) + s.feeds.length) % s.feeds.length];
          s.set({ activeFeed: next.id });
          nav("/");
          return;
        }
        case "?":
          openShortcuts();
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav]);
}
