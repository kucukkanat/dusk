export function fmtCount(n: number) {
  n = Math.round(n);
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return (k < 10 ? k.toFixed(1).replace(/\.0$/, "") : String(Math.round(k))) + "k";
  }
  const m = n / 1_000_000;
  return (m < 10 ? m.toFixed(1).replace(/\.0$/, "") : String(Math.round(m))) + "M";
}

export const sats = (n: number) => Number(n).toLocaleString("en-US");

/** "now", "5m", "3h", "2d", or a date */
export function ago(ts: number) {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 45) return "now";
  if (s < 3600) return Math.round(s / 60) + "m";
  if (s < 86400) return Math.round(s / 3600) + "h";
  if (s < 7 * 86400) return Math.round(s / 86400) + "d";
  const d = new Date(ts * 1000);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export function agoLong(ts: number) {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 45) return "just now";
  if (s < 3600) return plural(Math.round(s / 60), "minute") + " ago";
  if (s < 86400) return plural(Math.round(s / 3600), "hour") + " ago";
  if (s < 30 * 86400) return plural(Math.round(s / 86400), "day") + " ago";
  return new Date(ts * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function fullDate(ts: number) {
  return new Date(ts * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function plural(n: number, one: string, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}

export function initials(name: string) {
  return name
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => [...w][0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

export function middle(s: string, a = 10, b = 4) {
  return s.length > a + b + 1 ? s.slice(0, a) + "…" + s.slice(-b) : s;
}

export function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function readingMinutes(text: string) {
  return Math.max(1, Math.round(text.split(/\s+/).length / 230));
}
