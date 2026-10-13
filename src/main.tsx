import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { watchKeyboard } from "./lib/keyboard";
import "./index.css";
import App from "./App";
import { eventStore, pool } from "./nostr/core";
import { allTimelines } from "./nostr/timeline";

if (import.meta.env.VITE_RELAYS) (window as unknown as { __dusk: unknown }).__dusk = { eventStore, pool, allTimelines };

registerSW({ immediate: true });
watchKeyboard();

// iOS ignores user-scalable=no, so block pinch-zoom directly to keep the app feeling native.
for (const type of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
