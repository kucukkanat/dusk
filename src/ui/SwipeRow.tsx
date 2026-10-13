import { useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type SwipeSide = { label: string; icon: IconName; tone: string; run: () => void };

const TONE: Record<string, string> = { mist: "bg-mist", peach: "bg-peach", rose: "bg-rose", sage: "bg-sage", lilac: "bg-lilac", butter: "bg-butter", clay: "bg-clay" };
const SLOP = 10;
const COMMIT = 120;

/** A row that reveals an action when dragged sideways. Swipe right runs `start`, swipe left runs `end`. */
export function SwipeRow({ start, end, children, onLongPress }: { start?: SwipeSide; end?: SwipeSide; children: ReactNode; onLongPress?: () => void }) {
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const s = useRef<{ x: number; y: number; id: number; locked: "x" | "y" | null; t: ReturnType<typeof setTimeout> | null; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const t = onLongPress
      ? setTimeout(() => {
          if (s.current && !s.current.moved) {
            suppressClick.current = true;
            navigator.vibrate?.(10);
            onLongPress();
            s.current = null;
          }
        }, 500)
      : null;
    s.current = { x: e.clientX, y: e.clientY, id: e.pointerId, locked: null, t, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    const st = s.current;
    if (!st || st.id !== e.pointerId) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      st.moved = true;
      if (st.t) clearTimeout(st.t);
    }
    if (!st.locked) {
      if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy) * 1.3 && e.pointerType !== "mouse") {
        st.locked = "x";
        setDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else if (Math.abs(dy) > SLOP) st.locked = "y";
    }
    if (st.locked === "x") {
      let v = dx;
      if ((v > 0 && !start) || (v < 0 && !end)) v = v / 6;
      setX(Math.sign(v) * Math.min(Math.abs(v), 200));
    }
  };
  const up = () => {
    const st = s.current;
    s.current = null;
    if (st?.t) clearTimeout(st.t);
    if (st?.locked === "x") {
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 50);
      if (x > COMMIT && start) {
        navigator.vibrate?.(8);
        start.run();
      } else if (x < -COMMIT && end) {
        navigator.vibrate?.(8);
        end.run();
      }
    }
    setDragging(false);
    setX(0);
  };

  const side = x > 0 ? start : x < 0 ? end : undefined;
  const armed = Math.abs(x) > COMMIT;
  return (
    <div className="relative touch-pan-y overflow-hidden bg-surface select-none" onClickCapture={(e) => suppressClick.current && (e.stopPropagation(), e.preventDefault(), (suppressClick.current = false))}>
      {side && (
        <div className={`absolute inset-0 flex items-center gap-2 px-6 text-[15px] font-medium text-on-accent ${TONE[side.tone]} ${x > 0 ? "justify-start" : "justify-end"}`} aria-hidden="true">
          {x < 0 && <span>{side.label}</span>}
          <Icon name={side.icon} className={`transition-transform ${armed ? "scale-125" : "scale-90"}`} />
          {x > 0 && <span>{side.label}</span>}
        </div>
      )}
      <div
        className="relative z-[1] bg-surface"
        style={{ transform: `translateX(${x}px)`, transition: dragging ? "none" : "transform var(--spring-ms) var(--ease-spring)" }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onContextMenu={
          onLongPress
            ? (e) => {
                if ((e.target as HTMLElement).closest("a,button,img,video")) return;
                e.preventDefault();
                onLongPress();
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
