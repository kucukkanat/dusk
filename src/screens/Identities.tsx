import { useNavigate } from "react-router";
import { useAccounts, useActivePubkey, lockAccount, type Account } from "../state/accounts";
import { useProfile, nameOf, formatNip05 } from "../nostr/profile";
import { npub } from "../lib/links";
import { middle, agoLong } from "../lib/format";
import { openSheet, closeSheet, replaceSheet, copyText, toast } from "../state/ui";
import { Screen } from "../ui/Screen";
import { Avatar } from "../ui/primitives";
import { Icon } from "../ui/Icon";
import { SignIn, openOnboarding } from "./Onboarding";

const SIGNER = { extension: "Browser extension", bunker: "Remote signer", key: "Key on this device" } as const;

function Card({ a, active }: { a: Account; active: boolean }) {
  const p = useProfile(a.pubkey);
  const setActive = useAccounts((s) => s.setActive);
  const nav = useNavigate();
  return (
    <div className={`grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border p-4 ${active ? "border-accent bg-wash" : "border-line bg-surface"}`}>
      <Avatar pubkey={a.pubkey} />
      <div className="min-w-0">
        <div className="truncate text-base font-semibold">{nameOf(p, a.pubkey)}</div>
        <span className="block truncate text-[13px] text-muted">{p?.nip05 ? formatNip05(p.nip05) : middle(npub(a.pubkey), 12, 6)}</span>
        <span className="mt-0.5 flex items-center gap-1 text-[13px] text-subtle">
          <Icon name="key" size={14} />
          {SIGNER[a.type]} · added {agoLong(a.added)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {active ? (
          <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-sage px-3 text-[13px] font-medium text-on-accent">
            <Icon name="check" size={14} />
            Active
          </span>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setActive(a.pubkey);
              nav("/");
              toast(`Switched to ${nameOf(p, a.pubkey)}`);
            }}
          >
            Switch
          </button>
        )}
        <button type="button" className="iconbtn" aria-label={`Options for ${nameOf(p, a.pubkey)}`} onClick={() => openSheet(<More a={a} />, { label: "Identity options" })}>
          <Icon name="more" />
        </button>
      </div>
    </div>
  );
}

function More({ a }: { a: Account }) {
  const remove = useAccounts((s) => s.remove);
  const p = useProfile(a.pubkey);
  return (
    <ul className="grid gap-1">
      <li>
        <button type="button" className="flex min-h-[52px] w-full items-center gap-3 rounded-[8px] px-2 text-[15px] font-medium hover:bg-wash" onClick={() => (closeSheet(), copyText(npub(a.pubkey), "Copied public key"))}>
          <Icon name="copy" className="text-muted" />
          Copy public key
        </button>
      </li>
      <li>
        <button
          type="button"
          className="flex min-h-[52px] w-full items-center gap-3 rounded-[8px] px-2 text-[15px] font-medium text-clay-ink hover:bg-wash"
          onClick={() =>
            replaceSheet(
              <div className="grid gap-3">
                <h2 className="text-xl font-semibold">Remove {nameOf(p, a.pubkey)} from this device?</h2>
                <p className="text-[15px] text-muted">{a.type === "key" ? "The encrypted key is deleted from this device. You'll need your backup to sign in again." : "You can sign in again any time with your signer."}</p>
                <button
                  type="button"
                  className="btn btn-danger btn-lg"
                  onClick={() => {
                    lockAccount(a.pubkey);
                    remove(a.pubkey);
                    closeSheet();
                    toast("Removed");
                  }}
                >
                  Remove
                </button>
              </div>,
            )
          }
        >
          <Icon name="trash" />
          Remove from this device
        </button>
      </li>
    </ul>
  );
}

export function openAddIdentity() {
  openSheet(<AddIdentity />, { label: "Add identity" });
}

function AddIdentity() {
  return (
    <div className="grid gap-4">
      <SignIn embedded onDone={() => closeSheet()} />
      <div className="border-t border-line pt-3 text-center">
        <button type="button" className="btn btn-ghost" onClick={() => (closeSheet(), openOnboarding("name", "add"))}>
          Create a new identity instead
        </button>
      </div>
    </div>
  );
}

export function Identities() {
  const accounts = useAccounts((s) => s.accounts);
  const active = useActivePubkey();
  return (
    <Screen
      back
      title="Identities"
      actions={
        <button type="button" className="iconbtn" aria-label="Add identity" onClick={openAddIdentity}>
          <Icon name="plus" />
        </button>
      }
    >
      <p className="px-4 pt-4 text-[15px] text-muted">Each identity is its own Nostr key with its own follows, likes and messages. Switch any time.</p>
      <div className="grid gap-3 p-4">
        {accounts.map((a) => (
          <Card key={a.pubkey} a={a} active={a.pubkey === active} />
        ))}
      </div>
      <div className="px-4">
        <button type="button" className="btn btn-secondary btn-lg" onClick={openAddIdentity}>
          <Icon name="plus" />
          Add identity
        </button>
      </div>
      <p className="px-4 pt-3 text-[13px] text-muted">Keys stay in your signer, your browser extension, or encrypted on this device. Dusk never uploads them.</p>
    </Screen>
  );
}
