import type { ReactNode } from "react";
import { Link } from "react-router";
import { useProfile, nameOf, formatNip05 } from "../nostr/profile";
import { useActivePubkey } from "../state/accounts";
import { useFollowing, follow, unfollow } from "../nostr/lists";
import { requireSignIn } from "../note/actions";
import { profilePath } from "../lib/links";
import { Avatar } from "./primitives";

export function FollowButton({ pubkey, small }: { pubkey: string; small?: boolean }) {
  const me = useActivePubkey();
  const following = useFollowing(me);
  if (pubkey === me) return null;
  const on = following.has(pubkey);
  return (
    <button
      type="button"
      className={`btn ${on ? "btn-secondary" : "btn-primary"} ${small ? "btn-sm" : ""}`}
      aria-pressed={on}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!requireSignIn()) return;
        if (on) unfollow(pubkey);
        else follow(pubkey);
      }}
    >
      {on ? "Following" : "Follow"}
    </button>
  );
}

export function PersonRow({ pubkey, sub, right, onNavigate, noFollow }: { pubkey: string; sub?: ReactNode; right?: ReactNode; onNavigate?: () => void; noFollow?: boolean }) {
  const p = useProfile(pubkey);
  return (
    <div className="flex items-center gap-3 bg-surface px-4 py-3">
      <Link to={profilePath(pubkey)} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar pubkey={pubkey} />
        <span className="min-w-0">
          <b className="block truncate text-[15px] leading-[21px] font-semibold">{nameOf(p, pubkey)}</b>
          <span className="line-clamp-1 block text-[13px] leading-[18px] text-muted">{sub ?? (p?.nip05 ? formatNip05(p.nip05) : p?.about)}</span>
        </span>
      </Link>
      {right ?? (!noFollow && <FollowButton pubkey={pubkey} small />)}
    </div>
  );
}
