import { flushSync } from "react-dom";
import { useSettings } from "../state/settings";

/**
 * Shared-element transitions with the View Transitions API: the tapped element (an avatar, a photo,
 * a note) morphs into its counterpart on the next screen. Names are set only while a transition runs,
 * so two elements never share one. Browsers without the API, or with reduced motion, just update.
 */
type Kind = "morph" | "morph-card";

let pending: { key: string; kind: Kind } | null = null;

/** Per history entry reached by a morph: how to morph back into where we came from. */
type Back = { key: string; kind: Kind; find: () => Element | null };
const backs = new Map<number, Back>();
const historyIdx = (): number | undefined => window.history.state?.idx;
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

export function morph(update: () => void, opts: { from?: Element | null; key?: string; to?: () => Element | null | undefined; kind?: Kind; back?: () => Element | null } = {}) {
  if (!document.startViewTransition || reduced() || !opts.from) return update();
  const kind = opts.kind ?? "morph";
  clear();
  mark(opts.from, kind);
  pending = opts.key ? { key: opts.key, kind } : null;
  const t = document.startViewTransition(() => {
    clear(); // the source may stay on screen (e.g. under the lightbox), so it gives up the name first
    flushSync(update);
    mark(opts.to?.(), kind);
    const idx = historyIdx();
    if (opts.back && opts.key && idx != null) backs.set(idx, { key: opts.key, kind, find: opts.back });
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

/** Wait (up to ~600ms) for a back navigation to land and for `find` to locate its element. */
function landed(fromIdx: number | undefined, find: () => Element | null): Promise<Element | null> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      const moved = historyIdx() !== fromIdx;
      const el = moved ? find() : null;
      // one more task after the element appears so layout effects (scroll restore) have run
      if (el) return void setTimeout(() => resolve(el), 0);
      if (performance.now() - t0 > 600) return resolve(null);
      setTimeout(tick, 16);
    };
    tick();
  });
}

/** Go back, morphing the element this screen was opened from back into place when we know it. */
export function morphBack(go: () => void) {
  const idx = historyIdx();
  const b = idx != null ? backs.get(idx) : undefined;
  const from = b && document.querySelector(`[data-morph="${CSS.escape(b.key)}"]`);
  if (!b || !from || !document.startViewTransition || reduced()) return go();
  backs.delete(idx!);
  clear();
  mark(from, b.kind);
  const t = document.startViewTransition(async () => {
    clear();
    go();
    mark(await landed(idx, b.find), b.kind);
  });
  t.ready.catch(() => {});
  t.finished.finally(clear);
}
