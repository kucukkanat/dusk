import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { watchKeyboard } from "./lib/keyboard";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./index.css";
import App, { reloadForNewBuild } from "./App";
import { eventStore, pool } from "./nostr/core";
import { allTimelines } from "./nostr/timeline";

if (import.meta.env.VITE_RELAYS) (window as unknown as { __dusk: unknown }).__dusk = { eventStore, pool, allTimelines };

// register the service worker once the first screen is up, so its precache doesn't compete with startup
const sw = () => (window.requestIdleCallback ?? setTimeout)(() => registerSW({ immediate: true }));
if (document.readyState === "complete") sw();
else addEventListener("load", sw, { once: true });
watchKeyboard();

// After a deploy, a page still running the old build asks for screen files that no longer exist.
// Reload once to pick up the new build instead of leaving the tap doing nothing.
addEventListener("vite:preloadError", (e) => {
  e.preventDefault();
  reloadForNewBuild();
});

// iOS ignores user-scalable=no, so block pinch-zoom directly to keep the app feeling native.
for (const type of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
// A blocking touchmove listener stalls every scroll, so it's only attached while two fingers are down.
const noPinch = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
document.addEventListener("touchstart", (e) => { if (e.touches.length > 1) document.addEventListener("touchmove", noPinch, { passive: false }); }, { passive: true });
for (const type of ["touchend", "touchcancel"]) document.addEventListener(type, (e) => { if ((e as TouchEvent).touches.length < 2) document.removeEventListener("touchmove", noPinch); }, { passive: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
