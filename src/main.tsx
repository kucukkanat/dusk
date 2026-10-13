import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App";
import { eventStore, pool } from "./nostr/core";
import { allTimelines } from "./nostr/timeline";

if (import.meta.env.VITE_RELAYS) (window as unknown as { __dusk: unknown }).__dusk = { eventStore, pool, allTimelines };

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
