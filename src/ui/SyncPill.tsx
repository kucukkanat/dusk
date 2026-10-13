import { useEffect, useState } from "react";
import { useOutbox, retryFailed, dropFailed } from "../nostr/publish";
import { openSheet, closeSheet } from "../state/ui";
import { Icon } from "./Icon";

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true);
    const b = () => setOn(false);
    window.addEventListener("online", a);
    window.addEventListener("offline", b);
    return () => {
      window.removeEventListener("online", a);
      window.removeEventListener("offline", b);
    };
  }, []);
  return on;
}

/** The one place network state surfaces: offline, sending, or failed. */
export function SyncPill() {
  const items = useOutbox((s) => s.items);
  const online = useOnline();
  const sending = items.filter((i) => i.state === "sending").length;
  const failed = items.filter((i) => i.state === "failed");
  let state: "offline" | "pending" | "error" | null = null;
  let text = "";
  if (!online) {
    state = "offline";
    text = "Offline" + (items.length ? ` · ${items.length} waiting` : "");
  } else if (failed.length) {
    state = "error";
    text = failed.length === 1 ? "1 not sent" : `${failed.length} not sent`;
  } else if (sending) {
    state = "pending";
    text = "Sending";
  }
  if (!state) return null;
  const dot = { offline: "shadow-[inset_0_0_0_1.5px_var(--ink-muted)]", pending: "bg-butter", error: "bg-clay" }[state];
  return (
    <button
      type="button"
      className={`inline-flex min-h-7 items-center gap-2 rounded-full bg-raised px-3 text-[13px] leading-[18px] font-medium ${state === "error" ? "text-clay-ink" : "text-muted"}`}
      onClick={() => failed.length && openSheet(<FailedSheet />, { label: "Not sent" })}
    >
      <i className={`size-2 rounded-full ${dot}`} />
      {text}
    </button>
  );
}

function FailedSheet() {
  const items = useOutbox((s) => s.items);
  const failed = items.filter((i) => i.state === "failed");
  return (
    <div className="grid gap-3">
      <h2 className="text-xl font-semibold">Not sent</h2>
      <p className="text-[15px] text-muted">No server accepted these. They are kept here until you try again.</p>
      {failed.map((f) => (
        <div key={f.id} className="flex items-center gap-3 rounded-[14px] border border-line p-3">
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block text-[15px]">{f.event.content || `Kind ${f.kind} event`}</span>
            <span className="caption block">{f.error}</span>
          </span>
          <button type="button" className="iconbtn" aria-label="Discard" onClick={() => dropFailed(f.id)}>
            <Icon name="trash" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-primary btn-lg"
        onClick={() => {
          retryFailed();
          closeSheet();
        }}
      >
        Try again
      </button>
    </div>
  );
}
