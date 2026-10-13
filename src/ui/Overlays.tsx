import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useUI, closeSheet } from "../state/ui";
import { Icon } from "./Icon";

/** Bottom sheets on phones, centred cards on wider screens. Drag the handle down to close. */
export function SheetHost() {
  const sheets = useUI((s) => s.sheets);
  const loc = useLocation();
  // moving to another screen closes whatever sheet was open
  useEffect(() => {
    useUI.getState().closeAllSheets();
  }, [loc.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useUI.getState().sheets.length) {
        e.stopPropagation();
        closeSheet();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  return (
    <>
      {sheets.map((s, i) => (
        <SheetFrame key={s.id} id={s.id} label={s.label} top={i === sheets.length - 1} wide={s.wide}>
          {s.node}
        </SheetFrame>
      ))}
    </>
  );
}

function SheetFrame({ id, label, top, children, wide }: { id: number; label?: string; top: boolean; children: React.ReactNode; wide?: boolean }) {
  const [y, setY] = useState(0);
  const [drag, setDrag] = useState(false);
  const start = useRef<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!top) return;
    const el = ref.current;
    const prev = document.activeElement as HTMLElement | null;
    const f = el?.querySelector<HTMLElement>("[autofocus], textarea, input, button:not([data-grab])");
    f?.focus({ preventScroll: true });
    return () => prev?.focus?.({ preventScroll: true });
  }, [top]);

  const onDown = (e: React.PointerEvent) => {
    start.current = e.clientY;
    setDrag(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (start.current == null) return;
    setY(Math.max(0, e.clientY - start.current));
  };
  const onUp = () => {
    if (start.current == null) return;
    start.current = null;
    setDrag(false);
    if (y > 120) closeSheet(id);
    else setY(0);
  };

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0 bg-scrim animate-fade" onClick={() => closeSheet(id)} />
      <div
        ref={ref}
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[88%] flex-col rounded-t-[24px] bg-raised px-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-[var(--shadow-sheet)] animate-sheet md:bottom-6 md:max-h-[calc(100%-64px)] md:rounded-[24px] ${wide ? "md:max-w-[640px]" : "md:max-w-[520px]"}`}
        style={{ transform: `translateY(${y}px)`, transition: drag ? "none" : "transform 220ms var(--ease-calm)" }}
      >
        <button type="button" data-grab aria-label="Close" className="relative h-7 w-full flex-none cursor-grab touch-none after:absolute after:top-2.5 after:left-1/2 after:-ml-[18px] after:h-1 after:w-9 after:rounded-full after:bg-line-strong" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClick={() => y === 0 && !drag && closeSheet(id)} />
        <div className="min-h-0 overflow-y-auto pb-2">{children}</div>
      </div>
    </div>
  );
}

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto flex min-h-[52px] w-full max-w-[420px] items-center gap-3 rounded-[14px] border border-line bg-raised pr-2 pl-4 text-[15px] font-medium shadow-[var(--shadow-sheet)] animate-fade ${t.tone === "error" ? "text-clay-ink" : ""}`}>
          <span className="flex-1 py-3">{t.text}</span>
          {t.undo && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                t.undo?.();
                useUI.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }));
              }}
            >
              Undo
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

type Pt = { x: number; y: number };
type Touch = { clientX: number; clientY: number };
const dist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
const mid = (a: Touch, b: Touch): Pt => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });

/** Photo with its own pinch / double-tap zoom and pan (page zoom is disabled). At normal size, swipe sideways to step, down to close. */
function ZoomImage({ src, alt, onSwipe, onClose }: { src: string; alt: string; onSwipe: (d: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLImageElement>(null);
  const v = useRef({ s: 1, x: 0, y: 0 });
  const g = useRef({ kind: "", d0: 0, s0: 1, q: { x: 0, y: 0 }, start: { x: 0, y: 0 }, t0: { x: 0, y: 0 }, lastTap: 0 });

  const apply = (animate: boolean) => {
    const el = ref.current;
    if (!el) return;
    const { s, x, y } = v.current;
    el.style.transition = animate ? "transform 220ms var(--ease-calm)" : "none";
    el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  };
  const center = (): Pt => {
    const r = ref.current!.parentElement!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const clamp = () => {
    const el = ref.current!;
    const { s } = v.current;
    const mx = Math.max(0, ((s - 1) * el.offsetWidth) / 2);
    const my = Math.max(0, ((s - 1) * el.offsetHeight) / 2);
    v.current.x = Math.max(-mx, Math.min(mx, v.current.x));
    v.current.y = Math.max(-my, Math.min(my, v.current.y));
  };
  const zoomAt = (p: Pt, s: number) => {
    const c = center();
    const cur = v.current;
    const q = { x: (p.x - c.x - cur.x) / cur.s, y: (p.y - c.y - cur.y) / cur.s };
    v.current = { s, x: p.x - c.x - s * q.x, y: p.y - c.y - s * q.y };
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches;
    const st = g.current;
    if (t.length === 2) {
      const c = center();
      const m = mid(t[0], t[1]);
      const cur = v.current;
      Object.assign(st, { kind: "pinch", d0: dist(t[0], t[1]), s0: cur.s, q: { x: (m.x - c.x - cur.x) / cur.s, y: (m.y - c.y - cur.y) / cur.s } });
    } else if (t.length === 1) {
      const p = { x: t[0].clientX, y: t[0].clientY };
      if (e.timeStamp - st.lastTap < 280) {
        st.lastTap = 0;
        st.kind = "";
        if (v.current.s > 1) v.current = { s: 1, x: 0, y: 0 };
        else zoomAt(p, 2.5), clamp();
        return apply(true);
      }
      st.lastTap = e.timeStamp;
      Object.assign(st, { kind: v.current.s > 1 ? "pan" : "swipe", start: p, t0: { x: v.current.x, y: v.current.y } });
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches;
    const st = g.current;
    if (st.kind === "pinch" && t.length === 2) {
      const c = center();
      const m = mid(t[0], t[1]);
      const s = Math.max(0.8, Math.min(5, (st.s0 * dist(t[0], t[1])) / st.d0));
      v.current = { s, x: m.x - c.x - s * st.q.x, y: m.y - c.y - s * st.q.y };
      apply(false);
    } else if (t.length === 1 && (st.kind === "pan" || st.kind === "swipe")) {
      const dx = t[0].clientX - st.start.x;
      const dy = t[0].clientY - st.start.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) st.lastTap = 0;
      if (st.kind === "pan") v.current = { ...v.current, x: st.t0.x + dx, y: st.t0.y + dy };
      else v.current = { s: 1, x: dx, y: Math.abs(dy) > Math.abs(dx) ? Math.max(0, dy) : 0 };
      apply(false);
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const st = g.current;
    if (e.touches.length > 0) return;
    if (st.kind === "swipe") {
      const { x, y } = v.current;
      v.current = { s: 1, x: 0, y: 0 };
      if (y > 120) return onClose();
      if (Math.abs(x) > 60) onSwipe(x < 0 ? 1 : -1);
    } else if (v.current.s <= 1.05) v.current = { s: 1, x: 0, y: 0 };
    else clamp();
    st.kind = "";
    apply(true);
  };

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      className="max-h-full max-w-full touch-none object-contain will-change-transform select-none"
      onClick={(e) => e.stopPropagation()}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    />
  );
}

export function Lightbox() {
  const lb = useUI((s) => s.lightbox);
  const close = () => useUI.setState({ lightbox: null });
  useEffect(() => {
    if (!lb) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") useUI.setState({ lightbox: { ...lb, index: Math.min(lb.urls.length - 1, lb.index + 1) } });
      if (e.key === "ArrowLeft") useUI.setState({ lightbox: { ...lb, index: Math.max(0, lb.index - 1) } });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lb]);
  if (!lb) return null;
  const step = (d: number) => useUI.setState({ lightbox: { ...lb, index: Math.max(0, Math.min(lb.urls.length - 1, lb.index + d)) } });
  const alt = lb.alts?.[lb.index];
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 animate-fade" role="dialog" aria-label="Photo" onClick={close}>
      <div className="flex justify-end p-2 pt-[calc(8px+env(safe-area-inset-top))]">
        <button type="button" className="iconbtn text-white" aria-label="Close" onClick={close}>
          <Icon name="close" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <ZoomImage key={lb.urls[lb.index]} src={lb.urls[lb.index]} alt={alt ?? ""} onSwipe={step} onClose={close} />
        {lb.index > 0 && (
          <button type="button" className="iconbtn absolute left-2 bg-black/40 text-white" aria-label="Previous" onClick={(e) => (e.stopPropagation(), step(-1))}>
            <Icon name="back" />
          </button>
        )}
        {lb.index < lb.urls.length - 1 && (
          <button type="button" className="iconbtn absolute right-2 bg-black/40 text-white" aria-label="Next" onClick={(e) => (e.stopPropagation(), step(1))}>
            <Icon name="chev" />
          </button>
        )}
      </div>
      {(alt || lb.urls.length > 1) && (
        <div className="p-4 pb-[calc(16px+env(safe-area-inset-bottom))] text-center text-[14px] text-white/80" onClick={(e) => e.stopPropagation()}>
          {alt}
          {lb.urls.length > 1 && <div className="mt-1 text-white/50">{`${lb.index + 1} of ${lb.urls.length}`}</div>}
        </div>
      )}
    </div>
  );
}
