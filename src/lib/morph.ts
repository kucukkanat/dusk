import { flushSync } from "react-dom";
import { useSettings } from "../state/settings";

/**
 * Shared-element transitions with the View Transitions API: the tapped element (an avatar, a photo,
 * a note) morphs into its counterpart on the next screen. Names are set only while a transition runs,
 * so two elements never share one. Browsers without the API, or with reduced motion, just update.
 */
type Kind = "morph" | "morph-card";

let pending: { key: string; kind: Kind } | null = null;
let marked: HTMLElement[] = [];

const mark = (el: Element | null | undefined, kind: Kind) => {
  if (!(el instanceof HTMLElement)) return;
  el.style.viewTransitionName = kind;
  marked.push(el);
};
const clear = () => {
  for (const el of marked) el.style.viewTransitionName = "";
  marked = [];
};

const reduced = () => useSettings.getState().reduceMotion || matchMedia("(prefers-reduced-motion: reduce)").matches;

export function morph(update: () => void, opts: { from?: Element | null; key?: string; to?: () => Element | null | undefined; kind?: Kind } = {}) {
  if (!document.startViewTransition || reduced() || !opts.from) return update();
  const kind = opts.kind ?? "morph";
  clear();
  mark(opts.from, kind);
  pending = opts.key ? { key: opts.key, kind } : null;
  const t = document.startViewTransition(() => {
    clear(); // the source may stay on screen (e.g. under the lightbox), so it gives up the name first
    flushSync(update);
    mark(opts.to?.(), kind);
  });
  t.ready.catch(() => {});
  t.finished.finally(() => {
    pending = null;
    clear();
  });
}

/** Ref for the element a pending morph with this key should land on. */
export const morphTarget = (key: string) => (el: HTMLElement | null) => {
  if (el && pending?.key === key) mark(el, pending.kind);
};
