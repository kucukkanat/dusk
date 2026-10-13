import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useSettings } from "../state/settings";

type Box = { x: number; y: number; w: number; h: number };

const STRETCH_MS = 150;
const SETTLE_MS = 460;

/**
 * A highlight that moves to the active item: it first stretches to cover the old and new
 * positions (ease-in), then snaps onto the new item with a springy overshoot.
 */
export function Slider({ container, selector, deps, className }: { container: RefObject<HTMLElement | null>; selector: string; deps: unknown[]; className: string }) {
  const [box, setBox] = useState<Box | null>(null);
  const [transition, setTransition] = useState("none");
  const prev = useRef<Box | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = useSettings((s) => s.reduceMotion);

  const measure = (): Box | null => {
    const root = container.current;
    const el = root?.querySelector<HTMLElement>(selector);
    if (!root || !el || !el.offsetParent) return null;
    const r = el.getBoundingClientRect();
    const c = root.getBoundingClientRect();
    return { x: r.left - c.left + root.scrollLeft, y: r.top - c.top + root.scrollTop, w: r.width, h: r.height };
  };

  useLayoutEffect(() => {
    const target = measure();
    if (timer.current) clearTimeout(timer.current);
    const from = prev.current;
    prev.current = target;
    if (!target) return setBox(null);
    const motionOff = reduce || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!from || motionOff || (from.x === target.x && from.y === target.y)) {
      setTransition("none");
      setBox(target);
      return;
    }
    // 1. stretch across both items
    const x = Math.min(from.x, target.x);
    const y = Math.min(from.y, target.y);
    const union = { x, y, w: Math.max(from.x + from.w, target.x + target.w) - x, h: Math.max(from.y + from.h, target.y + target.h) - y };
    setTransition(`left ${STRETCH_MS}ms cubic-bezier(.55,0,.85,.35), top ${STRETCH_MS}ms cubic-bezier(.55,0,.85,.35), width ${STRETCH_MS}ms cubic-bezier(.55,0,.85,.35), height ${STRETCH_MS}ms cubic-bezier(.55,0,.85,.35)`);
    setBox(union);
    // 2. settle on the new item with a wobble
    timer.current = setTimeout(() => {
      const ease = "cubic-bezier(.3,1.9,.45,.85)";
      setTransition(`left ${SETTLE_MS}ms ${ease}, top ${SETTLE_MS}ms ${ease}, width ${SETTLE_MS}ms ${ease}, height ${SETTLE_MS}ms ${ease}`);
      setBox(target);
    }, STRETCH_MS);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  // follow layout changes (resizes, breakpoint changes) without animating
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const ro = new ResizeObserver(() => {
      const t = measure();
      prev.current = t;
      setTransition("none");
      setBox(t);
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!box) return null;
  return <span aria-hidden="true" className={`pointer-events-none absolute z-0 ${className}`} style={{ left: box.x, top: box.y, width: box.w, height: box.h, transition }} />;
}
