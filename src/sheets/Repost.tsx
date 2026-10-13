import type { NostrEvent } from "applesauce-core/helpers/event";
import { openSheet, closeSheet } from "../state/ui";
import { repost, deleteEvents } from "../note/actions";
import { openCompose } from "./Compose";
import { Icon } from "../ui/Icon";
import { toast, errorToast } from "../state/ui";

export function openRepost(event: NostrEvent, mine?: NostrEvent) {
  openSheet(<RepostSheet event={event} mine={mine} />, { label: "Repost" });
}

function Item({ icon, title, sub, onClick, danger }: { icon: "repost" | "quote" | "trash"; title: string; sub?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" className={`flex min-h-[52px] w-full items-center gap-3 rounded-[8px] px-2 text-left hover:bg-wash ${danger ? "text-clay-ink" : ""}`} onClick={onClick}>
      <Icon name={icon} className={danger ? "" : "text-muted"} />
      <span>
        <span className="block text-[15px] font-medium">{title}</span>
        {sub && <span className="caption block">{sub}</span>}
      </span>
    </button>
  );
}

function RepostSheet({ event, mine }: { event: NostrEvent; mine?: NostrEvent }) {
  return (
    <div className="grid gap-1">
      <h2 className="mb-2 text-xl font-semibold">Share this note</h2>
      {mine ? (
        <Item
          icon="trash"
          danger
          title="Undo repost"
          onClick={() => {
            closeSheet();
            deleteEvents([mine])
              .then(() => toast("Repost removed"))
              .catch((e) => errorToast(e, "Couldn't undo"));
          }}
        />
      ) : (
        <Item
          icon="repost"
          title="Repost"
          sub="Share it with your followers as is"
          onClick={() => {
            closeSheet();
            repost(event);
          }}
        />
      )}
      <Item
        icon="quote"
        title="Quote"
        sub="Add your own words above it"
        onClick={() => {
          closeSheet();
          openCompose({ quote: event });
        }}
      />
    </div>
  );
}
