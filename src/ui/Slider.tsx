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
  // `box` is what's shown; the element is sized to `base` (the item it rests on) and reaches `box` by
  // translate + scale only, so the animation stays on the compositor
  const [{ box, base }, setState] = useState<{ box: Box | null; base: Box | null }>({ box: null, base: null });
  const [transition, setTransition] = useState("none");
  const prev = useRef<Box | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = useSettings((s) => s.reduceMotion);

  const self = useRef<HTMLSpanElement>(null);
  // the highlight lives inside the container, so its parent is always there when effects run
  const rootEl = () => (self.current?.parentElement as HTMLElement | null) ?? container.current;
  const measure = (): Box | null => {
    const root = rootEl();
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
    if (!target) return setState({ box: null, base: null });
    const motionOff = reduce || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!from || motionOff || (from.x === target.x && from.y === target.y)) {
      setTransition("none");
      setState({ box: target, base: target });
      return;
    }
    // 1. stretch a little toward the new item (capped, so long jumps don't make a tall blob)
    //    and bulge sideways, wider on vertical moves and taller on horizontal ones
    const dx = target.x - from.x;
    const dy = target.y - from.y;
    const vertical = Math.abs(dy) >= Math.abs(dx);
    const union = { ...from };
    if (vertical) {
      const reach = Math.min(Math.abs(dy), from.h * 0.6);
      if (dy < 0) union.y -= reach;
      union.h += reach;
      const bulge = Math.min(8, 3 + Math.abs(dy) / 30);
      union.x -= bulge;
      union.w += bulge * 2;
    } else {
      const reach = Math.min(Math.abs(dx), from.w * 0.6);
      if (dx < 0) union.x -= reach;
      union.w += reach;
      const bulge = Math.min(6, 2 + Math.abs(dx) / 40);
      union.y -= bulge / 2;
      union.h += bulge;
    }
    setTransition(`transform ${STRETCH_MS}ms cubic-bezier(.55,0,.85,.35)`);
    setState({ box: union, base: target });
    // 2. settle on the new item with a wobble
    timer.current = setTimeout(() => {
      const ease = "cubic-bezier(.3,1.9,.45,.85)";
      setTransition(`transform ${SETTLE_MS}ms ${ease}`);
      setState({ box: target, base: target });
    }, STRETCH_MS);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  // follow layout changes (resizes, breakpoint changes) without animating
  useLayoutEffect(() => {
    const root = rootEl();
    if (!root) return;
    const ro = new ResizeObserver(() => {
      const t = measure();
      prev.current = t;
      setTransition("none");
      setState({ box: t, base: t });
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <span
      ref={self}
      aria-hidden="true"
      className={`pointer-events-none absolute z-0 ${className}`}
      style={
        box && base
          ? { left: 0, top: 0, width: base.w, height: base.h, transformOrigin: "0 0", transform: `translate(${box.x}px, ${box.y}px) scale(${box.w / (base.w || 1)}, ${box.h / (base.h || 1)})`, transition, willChange: "transform" }
          : { display: "none" }
      }
    />
  );
}
