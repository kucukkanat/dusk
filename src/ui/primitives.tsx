import { useState, type ReactNode, type ButtonHTMLAttributes } from "react";
import { Link, useNavigate } from "react-router";
import { morph, morphTarget } from "../lib/morph";
import { Icon, type IconName } from "./Icon";
import { useProfile, nameOf, pictureOf, toneOf, useNip05, formatNip05, type ProfileContent } from "../nostr/profile";
import { initials } from "../lib/format";
import { profilePath } from "../lib/links";
import { useSettings } from "../state/settings";

const TONE_BG: Record<string, string> = { mist: "bg-mist", peach: "bg-peach", rose: "bg-rose", sage: "bg-sage", lilac: "bg-lilac", butter: "bg-butter" };
const SIZE = { xs: "size-[22px] text-[10px]", sm: "size-7 text-xs", md: "size-10 text-[15px]", lg: "size-[72px] text-[26px]", xl: "size-24 text-[32px]" };

/** `profile`: pass it when the caller already has it (null = known missing) to skip a second subscription. */
export function Avatar({ pubkey, size = "md", ring, className = "", morphKey, profile }: { pubkey: string; size?: keyof typeof SIZE; ring?: boolean; className?: string; morphKey?: string; profile?: ProfileContent | null }) {
  const own = useProfile(profile === undefined ? pubkey : undefined);
  const p = profile === undefined ? own : (profile ?? undefined);
  const pic = pictureOf(p);
  const dataSaver = useSettings((s) => s.dataSaver);
  const [broken, setBroken] = useState(false);
  const show = pic && !broken && !(dataSaver && size !== "lg" && size !== "xl");
  return (
    <span
      ref={morphKey ? morphTarget(morphKey) : undefined}
      data-morph={morphKey}
      className={`relative inline-grid flex-none place-items-center overflow-hidden rounded-full font-semibold text-on-accent ${SIZE[size]} ${show ? "bg-raised" : TONE_BG[toneOf(pubkey)]} ${ring ? "shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--lilac)]" : ""} ${className}`}
      aria-hidden="true"
    >
      {show ? <img src={pic} alt="" loading="lazy" decoding="async" className="size-full object-cover" onError={() => setBroken(true)} /> : initials(nameOf(p, pubkey))}
    </span>
  );
}

export function AvatarLink({ pubkey, size = "md", className, profile }: { pubkey: string; size?: keyof typeof SIZE; className?: string; profile?: ProfileContent | null }) {
  const own = useProfile(profile === undefined ? pubkey : undefined);
  const p = profile === undefined ? own : (profile ?? undefined);
  const nav = useNavigate();
  const to = profilePath(pubkey);
  return (
    <Link
      to={to}
      aria-label={"View " + nameOf(p, pubkey)}
      data-avatar={pubkey}
      className={"rounded-full " + (className ?? "")}
      onClick={(e) => {
        e.stopPropagation();
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        const note = e.currentTarget.closest("[data-note]")?.getAttribute("data-note");
        const find = () => (note && document.querySelector(`[data-note="${note}"] [data-avatar="${pubkey}"] > span`)) || document.querySelector(`[data-avatar="${pubkey}"] > span`);
        morph(() => nav(to), { from: e.currentTarget.firstElementChild, key: "avatar:" + pubkey, back: find });
      }}
    >
      <Avatar pubkey={pubkey} size={size} profile={p ?? null} />
    </Link>
  );
}

export function Name({ pubkey, className = "" }: { pubkey: string; className?: string }) {
  const p = useProfile(pubkey);
  return <span className={className}>{nameOf(p, pubkey)}</span>;
}

export function Nip05({ pubkey, className = "", showInvalid = true }: { pubkey: string; className?: string; showInvalid?: boolean }) {
  const p = useProfile(pubkey);
  const state = useNip05(pubkey, p?.nip05);
  if (!p?.nip05 || (state === "invalid" && !showInvalid)) return null;
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 text-[13px] leading-[18px] ${state === "invalid" ? "text-subtle line-through" : "text-muted"} ${className}`} title={state === "invalid" ? "This address doesn't point to this key" : undefined}>
      {state === "valid" && <Icon name="verified" label="Verified" size={14} className="text-accent-ink" />}
      <span className="truncate">{formatNip05(p.nip05)}</span>
    </span>
  );
}

export function Group({ label, help, children, className = "" }: { label?: ReactNode; help?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {label && <div className="px-4 pt-6 pb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">{label}</div>}
      <div className="overflow-hidden bg-surface md:mx-4 md:rounded-[14px] md:border md:border-line [&>*+*]:border-t [&>*+*]:border-line">{children}</div>
      {help && <p className="px-4 pt-2 text-[13px] leading-[18px] text-muted">{help}</p>}
    </section>
  );
}

export function Row({ icon, title, sub, right, onClick, to, danger, className = "" }: { icon?: IconName | ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void; to?: string; danger?: boolean; className?: string }) {
  const inner = (
    <>
      {typeof icon === "string" ? <Icon name={icon as IconName} className={danger ? "text-clay-ink" : "text-muted"} /> : icon}
      <span className="min-w-0 flex-1 text-left">
        <span className={`block text-base leading-[22px] font-semibold ${danger ? "text-clay-ink" : ""}`}>{title}</span>
        {sub && <span className="block text-[13px] leading-[18px] text-muted">{sub}</span>}
      </span>
      {right}
      {(onClick || to) && !right && <Icon name="chev" className="text-subtle" size={18} />}
    </>
  );
  const cls = `flex min-h-14 w-full items-center gap-3 px-4 py-2 ${onClick || to ? "transition-colors hover:bg-wash active:bg-wash" : ""} ${className}`;
  if (to)
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

export function ToggleRow({ title, sub, checked, onChange }: { title: ReactNode; sub?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-base leading-[22px] font-semibold">{title}</span>
        {sub && <span className="block text-[13px] leading-[18px] text-muted">{sub}</span>}
      </span>
      <input type="checkbox" className="toggle" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function ChipSet<T extends string | number>({ options, value, onChange, disabled, label }: { options: [T, ReactNode][]; value: T; onChange: (v: T) => void; disabled?: T; label?: string }) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-3" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" className="chip" role="radio" aria-checked={value === v} disabled={v === disabled} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
      <h2 className="text-xl leading-[26px] font-semibold">{title}</h2>
      {children && <p className="max-w-sm text-[15px] leading-[21px] text-muted">{children}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label = "Loading", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex justify-center py-8 ${className}`} role="status" aria-label={label}>
      <span className="spinner" />
    </div>
  );
}

/** Placeholder rows shaped like notes, shown while a feed loads. */
export function FeedSkeleton({ count = 4, label = "Loading" }: { count?: number; label?: string }) {
  const widths = [["92%", "78%", "40%"], ["85%", "60%"], ["96%", "88%", "70%", "35%"], ["70%"]];
  return (
    <div role="status" aria-label={label} className="[&>*+*]:border-t [&>*+*]:border-line">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid grid-cols-[40px_1fr] gap-3 bg-surface px-4 py-4" aria-hidden="true">
          <span className="skeleton size-10 rounded-full" />
          <div className="min-w-0 pt-0.5">
            <div className="mb-3 flex gap-2">
              <span className="skeleton h-3.5 w-28 rounded-md" />
              <span className="skeleton h-3.5 w-10 rounded-md" />
            </div>
            {widths[i % widths.length].map((w, j) => (
              <span key={j} className="skeleton mb-2 block h-3 rounded-md" style={{ width: w }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Endcap({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-[13px] text-subtle">{children}</p>;
}

export function IconButton({ icon, label, className = "", children, ...rest }: { icon: IconName; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={"iconbtn " + className} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
      {children}
    </button>
  );
}

export function Field({ label, help, error, children }: { label?: ReactNode; help?: ReactNode; error?: ReactNode; children: ReactNode }) {
  return (
    <label className="grid gap-1">
      {label && <span className="text-[15px] leading-[21px] font-medium">{label}</span>}
      {children}
      {(error || help) && <span className={`text-[13px] leading-[18px] ${error ? "text-clay-ink" : "text-muted"}`}>{error || help}</span>}
    </label>
  );
}

export function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-[14px] border border-line bg-raised p-3 text-[14px] leading-5 text-muted">
      <Icon name="warn" className="text-clay-ink" />
      <span>{children}</span>
    </div>
  );
}

export function StatusDot({ state }: { state: "ok" | "slow" | "err" | "off" }) {
  const cls = { ok: "bg-sage", slow: "bg-butter", err: "bg-clay", off: "shadow-[inset_0_0_0_1.5px_var(--ink-muted)]" }[state];
  return <i className={`inline-block size-2 rounded-full ${cls}`} />;
}
