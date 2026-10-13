import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useUI, closeSheet } from "../state/ui";
import { Icon } from "./Icon";
import { Avatar, Name } from "./primitives";

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
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
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
        <img src={lb.urls[lb.index]} alt={alt ?? ""} className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
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

export function UnlockPrompt() {
  const req = useUI((s) => s.unlock);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  if (!req) return null;
  const done = (v: string | null) => {
    useUI.setState({ unlock: null });
    setPw("");
    setBusy(false);
    req.resolve(v);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label="Unlock your key">
      <div className="absolute inset-0 bg-scrim" onClick={() => done(null)} />
      <form
        className="relative grid w-full max-w-[420px] gap-4 rounded-t-[24px] bg-raised p-5 pb-[calc(20px+env(safe-area-inset-bottom))] md:rounded-[24px]"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setTimeout(() => done(pw), 10);
        }}
      >
        <div className="flex items-center gap-3">
          <Avatar pubkey={req.pubkey} />
          <div>
            <h2 className="text-xl font-semibold">Unlock your key</h2>
            <p className="caption">
              <Name pubkey={req.pubkey} /> · one-time unlock; after this Dusk won't ask again
            </p>
          </div>
        </div>
        <input className="field" type="password" autoFocus autoComplete="current-password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-lg" disabled={!pw || busy}>
          {busy ? "Unlocking…" : "Unlock"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => done(null)}>
          Not now
        </button>
      </form>
    </div>
  );
}
