import { getProfileContent } from "applesauce-core/helpers/profile";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { getContacts } from "applesauce-core/helpers/contacts";
import { eventStore, healthy, quick$, SEARCH_RELAYS } from "./core";
import { getActivePubkey } from "../state/accounts";
import { nameOf } from "./profile";

/** Match people we already know about (profiles in memory), followed people first. */
export function searchLocalProfiles(q: string, limit = 8): string[] {
  const query = q.toLowerCase().replace(/^@/, "");
  if (!query) return [];
  const me = getActivePubkey();
  const contacts = me ? eventStore.getReplaceable(3, me) : undefined;
  const follows = new Set(contacts ? getContacts(contacts).map((p) => p.pubkey) : []);
  const scored: [string, number][] = [];
  for (const ev of eventStore.getByFilters({ kinds: [0] })) {
    const p = getProfileContent(ev);
    if (!p) continue;
    const hay = [p.name, p.display_name, p.displayName, p.nip05].filter(Boolean).join(" ").toLowerCase();
    const i = hay.indexOf(query);
    if (i < 0) continue;
    let score = i === 0 ? 3 : 1;
    if (follows.has(ev.pubkey)) score += 5;
    if (nameOf(p, ev.pubkey).toLowerCase().startsWith(query)) score += 2;
    scored.push([ev.pubkey, score]);
  }
  return scored
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([p]) => p);
}

/** NIP-50 search on relays that support it. Results stream through `onEvent` as they arrive. */
export function searchRelays(q: string, kinds: number[], limit = 40, onEvent?: (e: NostrEvent) => void): Promise<NostrEvent[]> {
  const out: NostrEvent[] = [];
  return new Promise((resolve) => {
    quick$(healthy(SEARCH_RELAYS), { kinds, search: q, limit }, { settle: 1000, cap: 7000 }).subscribe({
      next: (e) => {
        out.push(e);
        onEvent?.(e);
      },
      complete: () => resolve(out),
      error: () => resolve(out),
    });
  });
}

/** Hashtags seen recently in memory, most used first. */
export function trendingTags(limit = 8, since = Math.floor(Date.now() / 1000) - 86400): { tag: string; n: number }[] {
  const counts = new Map<string, Set<string>>();
  for (const e of eventStore.getByFilters({ kinds: [1, 20], since })) {
    for (const t of e.tags) {
      if (t[0] !== "t" || !t[1]) continue;
      const tag = t[1].toLowerCase();
      if (tag.length > 30 || /^\d+$/.test(tag)) continue;
      const s = counts.get(tag) ?? new Set();
      s.add(e.pubkey);
      counts.set(tag, s);
    }
  }
  return [...counts.entries()]
    .map(([tag, s]) => ({ tag, n: s.size }))
    .filter((x) => x.n > 1)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit);
}

export function recentTags(q: string, limit = 6) {
  const query = q.toLowerCase().replace(/^#/, "");
  return trendingTags(200, 0)
    .filter((t) => t.tag.startsWith(query))
    .slice(0, limit)
    .map((t) => t.tag);
}
