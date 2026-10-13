import { useEffect, useRef, useState } from "react";
import { publish } from "../nostr/publish";
import { ensureLatest } from "../nostr/actions";
import { eventStore } from "../nostr/core";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { uploadFile } from "../nostr/upload";
import { useActivePubkey } from "../state/accounts";
import { openSheet, closeSheet, toast, errorToast } from "../state/ui";
import { Field, Avatar } from "../ui/primitives";
import { Icon } from "../ui/Icon";

export function openEditProfile() {
  openSheet(<EditProfile />, { label: "Edit profile", wide: true });
}

function parse(ev?: NostrEvent): P | null {
  if (!ev) return null;
  try {
    return JSON.parse(ev.content);
  } catch {
    return {};
  }
}

type P = { name?: string; display_name?: string; about?: string; picture?: string; banner?: string; website?: string; nip05?: string; lud16?: string; [k: string]: unknown };

function EditProfile() {
  const me = useActivePubkey()!;
  // start from the copy we hold; the latest from relays is fetched quietly and merged in at save time
  const [base, setBase] = useState<P | null>(() => parse(eventStore.getReplaceable(0, me)));
  const [p, setP] = useState<P>(() => base ?? {});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"picture" | "banner" | null>(null);
  const pic = useRef<HTMLInputElement>(null);
  const ban = useRef<HTMLInputElement>(null);
  const latest = useRef<Promise<P | null>>(null);

  useEffect(() => {
    const had = !!eventStore.getReplaceable(0, me);
    latest.current = ensureLatest(0, me).then(
      (ev) => parse(ev),
      () => null,
    );
    if (!had)
      latest.current.then((c) => {
        setBase(c ?? {});
        setP(c ?? {});
      });
  }, [me]);

  const upload = async (field: "picture" | "banner", f?: File) => {
    if (!f) return;
    setUploading(field);
    try {
      const u = await uploadFile(f);
      setP((x) => ({ ...x, [field]: u.url }));
    } catch (e) {
      errorToast(e, "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const edits = Object.fromEntries(Object.entries(p).filter(([k, v]) => v !== base?.[k]));
      const content: P = { ...((await latest.current) ?? base ?? {}), ...edits };
      if (content.display_name && !content.name) content.name = content.display_name;
      for (const k of Object.keys(content)) if (content[k] === "") delete content[k];
      await publish({ kind: 0, content: JSON.stringify(content) });
      closeSheet();
      toast("Profile updated");
    } catch (e) {
      errorToast(e, "Couldn't save");
    } finally {
      setBusy(false);
    }
  };

  if (!base)
    return (
      <div className="grid justify-items-center gap-2 py-10">
        <span className="spinner" />
        <span className="caption">Fetching your latest profile…</span>
      </div>
    );

  const set = (k: keyof P) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setP((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <h2 className="text-xl font-semibold">Edit profile</h2>
      <div className="relative">
        <button type="button" className="block h-28 w-full overflow-hidden rounded-[14px] bg-surface" onClick={() => ban.current?.click()} aria-label="Change banner">
          {p.banner ? <img src={p.banner} alt="" className="size-full object-cover" /> : <span className="caption">Add a banner</span>}
          {uploading === "banner" && <span className="absolute inset-0 grid place-items-center bg-black/30"><span className="spinner" /></span>}
        </button>
        <button type="button" className="absolute -bottom-6 left-4 rounded-full shadow-[0_0_0_4px_var(--surface-raised)]" onClick={() => pic.current?.click()} aria-label="Change photo">
          {p.picture ? <img src={p.picture} alt="" className="size-[72px] rounded-full object-cover" /> : <Avatar pubkey={me} size="lg" />}
          <span className="absolute right-0 bottom-0 grid size-7 place-items-center rounded-full bg-accent text-on-accent">{uploading === "picture" ? <span className="spinner size-4" /> : <Icon name="edit" size={16} />}</span>
        </button>
        <input ref={pic} type="file" accept="image/*" hidden onChange={(e) => upload("picture", e.target.files?.[0])} />
        <input ref={ban} type="file" accept="image/*" hidden onChange={(e) => upload("banner", e.target.files?.[0])} />
      </div>
      <div className="h-4" />
      <Field label="Name">
        <input className="field" value={(p.display_name as string) ?? p.name ?? ""} onChange={(e) => setP((x) => ({ ...x, display_name: e.target.value, name: x.name || e.target.value }))} />
      </Field>
      <Field label="About">
        <textarea className="field" rows={3} value={p.about ?? ""} onChange={set("about")} />
      </Field>
      <Field label="Website">
        <input className="field" inputMode="url" value={p.website ?? ""} onChange={set("website")} />
      </Field>
      <Field label="Verified address" help="name@domain.com, set up on a site you control (NIP-05)">
        <input className="field" value={p.nip05 ?? ""} onChange={set("nip05")} />
      </Field>
      <Field label="Lightning address" help="Where zaps are sent, e.g. you@getalby.com">
        <input className="field" value={p.lud16 ?? ""} onChange={set("lud16")} />
      </Field>
      <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !!uploading}>
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
