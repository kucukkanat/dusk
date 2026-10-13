import { createContext, useCallback, useMemo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { Icon } from "./Icon";
import { SyncPill } from "./SyncPill";
import { morphBack } from "../lib/morph";
import { openCompose } from "../sheets/Compose";

type Props = {
  title?: ReactNode;
  titleNode?: ReactNode;
  back?: boolean;
  actions?: ReactNode;
  sub?: ReactNode;
  footer?: ReactNode;
  fab?: boolean;
  onRefresh?: () => Promise<unknown> | void;
  onEnd?: () => void;
  children: ReactNode;
  /** Remember scroll position under this key */
  scrollKey?: string;
  chat?: boolean;
  wide?: boolean;
  onTopbarSwipe?: (dir: 1 | -1) => void;
};

const scrollMem = new Map<string, number>();

/** The screen's scroll container and scroll key, for lists that window themselves (NoteList). */
export const ScrollerContext = createContext<{ el: HTMLElement | null; key: string } | null>(null);

export function useBack() {
  const nav = useNavigate();
  return () => {
    if (window.history.state && window.history.state.idx > 0) morphBack(() => nav(-1));
    else nav("/");
  };
}

export function Screen({ title, titleNode, back, actions, sub, footer, fab, onRefresh, onEnd, children, scrollKey, chat, wide, onTopbarSwipe }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const setRef = useCallback((n: HTMLDivElement | null) => {
    ref.current = n;
    setScroller(n);
  }, []);
  const endRef = useRef<HTMLDivElement>(null);
  const goBack = useBack();
  const loc = useLocation();
  const key = scrollKey ?? loc.pathname;
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // restore and remember scroll position per screen (before paint, so a morph back lands in place)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (chat) el.scrollTop = el.scrollHeight;
    else el.scrollTop = scrollMem.get(key) ?? 0;
    const want = chat ? 0 : (scrollMem.get(key) ?? 0);
    // windowed lists render their rows a moment later: keep re-applying until the content is tall
    // enough, the user takes over, or a second has passed
    let ro: ResizeObserver | null = null;
    const stop = () => (ro?.disconnect(), (ro = null));
    if (want > 0 && Math.abs(el.scrollTop - want) > 1 && el.firstElementChild) {
      ro = new ResizeObserver(() => {
        el.scrollTop = want;
        if (Math.abs(el.scrollTop - want) <= 1) stop();
      });
      for (const c of el.children) ro.observe(c);
      setTimeout(stop, 1000);
    }
    const onScroll = () => scrollMem.set(key, el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("touchstart", stop, { passive: true });
    el.addEventListener("wheel", stop, { passive: true });
    return () => {
      stop();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("wheel", stop);
    };
  }, [key, chat]);

  // chats stay pinned to the newest message when the scroller shrinks (keyboard opening) or grows
  useEffect(() => {
    const el = ref.current;
    if (!el || !chat) return;
    let atBottom = true;
    const onScroll = () => (atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48);
    const ro = new ResizeObserver(() => atBottom && (el.scrollTop = el.scrollHeight));
    el.addEventListener("scroll", onScroll, { passive: true });
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => (el.removeEventListener("scroll", onScroll), ro.disconnect());
  }, [chat]);

  // callers pass inline handlers; keep the latest in refs so observers and listeners are set up once
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const hasEnd = !!onEnd;
  const hasRefresh = !!onRefresh;

  // infinite scroll
  useEffect(() => {
    if (!hasEnd || !endRef.current) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && onEndRef.current?.(), { root: ref.current, rootMargin: "800px" });
    io.observe(endRef.current);
    return () => io.disconnect();
  }, [hasEnd]);

  // pull to refresh (touch)
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasRefresh) return;
    let y0 = 0;
    let active = false;
    let d = 0;
    const start = (e: TouchEvent) => {
      if (el.scrollTop > 0) return;
      y0 = e.touches[0].clientY;
      active = true;
      d = 0;
    };
    const move = (e: TouchEvent) => {
      if (!active) return;
      d = Math.max(0, e.touches[0].clientY - y0);
      if (d > 0 && el.scrollTop <= 0) setPull(Math.min(90, d * 0.5));
      else setPull(0);
    };
    const end = () => {
      if (!active) return;
      active = false;
      if (d * 0.5 >= 64) {
        setRefreshing(true);
        Promise.resolve(onRefreshRef.current?.()).finally(() => {
          setRefreshing(false);
          setPull(0);
        });
      } else setPull(0);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchend", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
    };
  }, [hasRefresh]);

  // swipe from the left edge to go back, like a native navigation stack
  const sectionRef = useRef<HTMLElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const backRef = useRef(goBack);
  backRef.current = goBack;
  // the same screen component can be reused for the previous route, so clear any leftover offset
  useEffect(() => {
    const el = sectionRef.current;
    if (el) (el.style.transform = ""), (el.style.transition = "");
    if (shadeRef.current) (shadeRef.current.style.opacity = ""), (shadeRef.current.style.transition = "");
  }, [loc.key]);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !back) return;
    let x0 = 0, y0 = 0, t0 = 0, dx = 0;
    let state: "idle" | "maybe" | "drag" = "idle";
    const set = (x: number, animate: boolean) => {
      el.style.transition = animate ? (x ? "transform 200ms var(--ease-calm)" : "transform var(--spring-ms) var(--ease-spring)") : "none";
      el.style.transform = x ? `translateX(${x}px)` : "";
      // the edge shadow is a separate layer that only fades, so nothing repaints a blur per frame
      const shade = shadeRef.current;
      if (shade) {
        shade.style.transition = animate ? "opacity 200ms" : "none";
        shade.style.opacity = x ? "1" : "";
      }
    };
    // the blocking (non-passive) move listener only exists while a touch that started at the edge is down
    const move = (e: TouchEvent) => {
      if (state === "idle") return;
      const t = e.touches[0];
      dx = Math.max(0, t.clientX - x0);
      if (state === "maybe") {
        if (Math.abs(t.clientY - y0) > 10) return void ((state = "idle"), detach());
        if (dx < 10) return;
        state = "drag";
      }
      e.preventDefault();
      set(dx, false);
    };
    const detach = () => el.removeEventListener("touchmove", move);
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || t.clientX > 24) return;
      x0 = t.clientX; y0 = t.clientY; t0 = e.timeStamp; dx = 0;
      state = "maybe";
      el.addEventListener("touchmove", move, { passive: false });
    };
    const end = (e: TouchEvent) => {
      detach();
      if (state !== "drag") return void (state = "idle");
      state = "idle";
      const fast = dx / Math.max(1, e.timeStamp - t0) > 0.5;
      if (dx > el.offsetWidth * 0.35 || (fast && dx > 40)) {
        set(el.offsetWidth, true);
        setTimeout(() => backRef.current(), 180);
      } else set(0, true);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      detach();
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [back]);

  // swipe the top bar sideways to switch feeds
  const tx = useRef<number | null>(null);
  const ctx = useMemo(() => ({ el: scroller, key }), [scroller, key]);

  return (
    <section ref={sectionRef} className="relative flex h-full min-h-0 flex-col bg-bg animate-fade" data-screen>
      {back && <div ref={shadeRef} aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-full w-8 bg-[linear-gradient(to_left,rgba(0,0,0,0.25),transparent)] opacity-0" />}
      <header
        className={`flex min-h-14 flex-none items-center gap-2 bg-bg pt-[env(safe-area-inset-top)] pr-2 ${back ? "pl-1" : "pl-4"}`}
        onTouchStart={onTopbarSwipe ? (e) => (tx.current = e.touches[0].clientX) : undefined}
        onTouchEnd={
          onTopbarSwipe
            ? (e) => {
                if (tx.current == null) return;
                const dx = e.changedTouches[0].clientX - tx.current;
                tx.current = null;
                if (Math.abs(dx) > 60) onTopbarSwipe(dx < 0 ? 1 : -1);
              }
            : undefined
        }
      >
        {back && (
          <button type="button" className="iconbtn" aria-label="Back" onClick={goBack}>
            <Icon name="back" />
          </button>
        )}
        {titleNode ?? <h1 className="min-w-0 flex-1 truncate text-xl leading-[26px] font-semibold">{title}</h1>}
        <div className="flex items-center gap-1">
          <SyncPill />
          {actions}
        </div>
      </header>
      {sub}
      <div ref={setRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain" data-scroller>
        {onRefresh && (pull > 0 || refreshing) && (
          <div className="flex items-center justify-center text-[13px] text-muted" style={{ height: refreshing ? 56 : pull }}>
            {refreshing ? <span className="spinner" /> : pull >= 64 ? "Release to refresh" : "Pull to refresh"}
          </div>
        )}
        <div className={`mx-auto ${wide ? "" : "max-w-[600px]"} pb-24 md:pb-8`}>
          <ScrollerContext.Provider value={ctx}>{children}</ScrollerContext.Provider>
          {onEnd && <div ref={endRef} className="h-px" />}
        </div>
      </div>
      {footer}
      {fab && (
        <button
          type="button"
          className="absolute right-4 bottom-4 z-10 grid size-[52px] place-items-center rounded-full bg-accent text-on-accent shadow-[var(--shadow-sheet)] md:hidden"
          aria-label="New note"
          onClick={() => openCompose({})}
        >
          <Icon name="plus" />
        </button>
      )}
    </section>
  );
}

export function Chips({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="no-scrollbar flex flex-none gap-2 overflow-x-auto px-4 py-2" role="tablist" aria-label={label}>
      {children}
    </div>
  );
}
