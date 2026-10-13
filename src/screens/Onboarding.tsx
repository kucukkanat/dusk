import { useEffect, useMemo, useState } from "react";
import { generateSeedWords } from "nostr-tools/nip06";
import { loginExtension, loginBunker, loginKey, loginPasskey, startNostrConnect, createAccount, hasExtension } from "../state/login";
import { passkeySupported, createPasskey, unlockPasskey } from "../lib/passkey";
import { copyText, errorToast, toast } from "../state/ui";
import { requestAll } from "../nostr/timeline";
import { LOOKUP_RELAYS, DEFAULT_RELAYS, uniqRelays } from "../nostr/core";
import { Icon, type IconName } from "../ui/Icon";
import { Avatar, Field, Warn } from "../ui/primitives";
import { useProfile, nameOf } from "../nostr/profile";
import { SUGGESTED } from "../nostr/feeds";

import { useOnb, closeOnboarding, type Step } from "../state/onboarding";
export { openOnboarding, closeOnboarding, useOnboarding } from "../state/onboarding";

function Shell({ children, step, total }: { children: React.ReactNode; step?: number; total?: number }) {
  const mode = useOnb((s) => s.mode);
  return (
    <div data-fill className="fixed inset-0 z-50 overflow-y-auto bg-bg animate-fade">
      <div className="mx-auto flex min-h-full max-w-[460px] flex-col gap-4 px-6 pt-[calc(24px+env(safe-area-inset-top))] pb-[calc(32px+var(--safe-b))]">
        <div className="flex items-center justify-between">
          {step ? <span className="text-[13px] font-semibold tracking-wide text-muted uppercase">{`Step ${step} of ${total}`}</span> : <span />}
          <button type="button" className="iconbtn" aria-label="Close" onClick={closeOnboarding}>
            <Icon name="close" />
          </button>
        </div>
        {children}
        {mode === "first" && <span className="flex-1" />}
      </div>
    </div>
  );
}

export function Onboarding() {
  const step = useOnb((s) => s.step);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const words = useMemo(() => generateSeedWords(), []);
  const [saved, setSaved] = useState(false);
  const [picks, setPicks] = useState<Set<string>>(new Set(SUGGESTED.slice(0, 4)));
  const [busy, setBusy] = useState(false);
  // how the new key is kept: a passkey (derived key, nothing to write down) or 12 seed words
  const [keep, setKeep] = useState<"choose" | "words">(passkeySupported() ? "choose" : "words");
  const [pk, setPk] = useState<{ sk: Uint8Array; credId: string } | null>(null);
  const [pkErr, setPkErr] = useState("");
  const go = (s: Step) => useOnb.setState({ step: s });
  const usePasskey = async () => {
    setPkErr("");
    setBusy(true);
    try {
      setPk(await createPasskey(name.trim()));
      go("follows");
    } catch (e) {
      setPkErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (step === "follows") requestAll(uniqRelays(LOOKUP_RELAYS, DEFAULT_RELAYS), [{ kinds: [0, 10002], authors: SUGGESTED }], 5000);
  }, [step]);

  if (step === "welcome")
    return (
      <Shell>
        <div className="relative mt-8 mb-4 h-40 overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,var(--lilac)_0%,var(--peach)_60%,var(--mist)_100%)] opacity-90" aria-hidden="true">
          <i className="absolute inset-x-10 bottom-[24%] h-px bg-bg/40" />
          <i className="absolute inset-x-24 bottom-[14%] h-px bg-bg/40" />
        </div>
        <h1 className="text-[32px] leading-[38px] font-semibold">Quiet by default</h1>
        <p className="text-[17px] leading-[26px] text-muted">Dusk is a calm way to read and post on Nostr. No email, no phone number. Your account is a key you hold.</p>
        <button type="button" className="btn btn-primary btn-lg mt-4" onClick={() => go("name")}>
          Create an account
        </button>
        <button type="button" className="btn btn-secondary btn-lg" onClick={() => go("signin")}>
          I already have one
        </button>
        <button type="button" className="btn btn-ghost" onClick={closeOnboarding}>
          Just look around
        </button>
      </Shell>
    );

  if (step === "name")
    return (
      <Shell step={1} total={3}>
        <h1 className="text-[28px] leading-[34px] font-semibold">What should people call you?</h1>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) go("backup");
          }}
        >
          <Field label="Display name">
            <input className="field" autoFocus autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={<>About you <span className="caption">(optional)</span></>}>
            <textarea className="field" rows={2} placeholder="A line or two" value={about} onChange={(e) => setAbout(e.target.value)} />
          </Field>
          <button type="submit" className="btn btn-primary btn-lg" disabled={!name.trim()}>
            Continue
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => go("welcome")}>
            Back
          </button>
        </form>
      </Shell>
    );

  if (step === "backup" && keep === "choose")
    return (
      <Shell step={2} total={3}>
        <h1 className="text-[28px] leading-[34px] font-semibold">How should we keep your key?</h1>
        <p className="text-[16px] leading-6 text-muted">Your account is a key only you hold. Nobody, including Dusk, can reset it.</p>
        <div className="grid gap-2">
          <Option icon="lock" title="Passkey" sub="Face ID, fingerprint or your device PIN. Your password manager keeps it and syncs it to your other devices." selected={false} onClick={usePasskey} />
          <Option icon="key" title="12 words" sub="Write them down and keep them somewhere safe. Works anywhere." selected={false} onClick={() => setKeep("words")} />
        </div>
        {busy && <p className="caption">Waiting for your passkey…</p>}
        {pkErr && <p className="text-[13px] text-clay-ink">{pkErr}</p>}
        <button type="button" className="btn btn-ghost" onClick={() => go("signin")}>
          I already have a key or signer
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => go("name")}>
          Back
        </button>
      </Shell>
    );

  if (step === "backup")
    return (
      <Shell step={2} total={3}>
        <h1 className="text-[28px] leading-[34px] font-semibold">Your key, in 12 words</h1>
        <p className="text-[16px] leading-6 text-muted">These words are your account. If you lose this device, they bring everything back. Nobody, including Dusk, can reset them.</p>
        <ol className="grid grid-cols-3 gap-2 rounded-[14px] border border-line bg-surface p-3">
          {words.split(" ").map((w, i) => (
            <li key={i} className="flex gap-1.5 text-[15px]">
              <span className="w-5 text-right text-subtle tabular-nums">{i + 1}</span>
              <span className="font-mono">{w}</span>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn-secondary" onClick={() => copyText(words, "Copied words")}>
          <Icon name="copy" size={18} />
          Copy words
        </button>
        <label className="flex items-center gap-3 text-[15px]">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-5" />I wrote them down somewhere safe
        </label>
        <button type="button" className="btn btn-primary btn-lg" disabled={!saved} onClick={() => go("follows")}>
          Continue
        </button>
        {passkeySupported() && (
          <button type="button" className="btn btn-ghost" onClick={() => setKeep("choose")}>
            Use a passkey instead
          </button>
        )}
      </Shell>
    );

  if (step === "follows")
    return (
      <Shell step={3} total={3}>
        <h1 className="text-[28px] leading-[34px] font-semibold">Pick a few people to start</h1>
        <p className="text-[16px] leading-6 text-muted">You can change this any time. Your home feed shows notes from people you follow.</p>
        <div className="overflow-hidden rounded-[14px] border border-line [&>*+*]:border-t [&>*+*]:border-line">
          {SUGGESTED.map((pk) => (
            <Suggestion key={pk} pubkey={pk} on={picks.has(pk)} toggle={() => setPicks((s) => (s.has(pk) ? new Set([...s].filter((x) => x !== pk)) : new Set([...s, pk])))} />
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await createAccount({ ...(pk ? { passkey: pk } : { words }), name: name.trim(), about: about.trim(), follows: [...picks] });
              closeOnboarding();
              toast("Welcome to Dusk");
            } catch (e) {
              errorToast(e, "Couldn't create your account");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Setting up…" : "Start reading"}
        </button>
      </Shell>
    );

  return <SignIn />;
}

function Suggestion({ pubkey, on, toggle }: { pubkey: string; on: boolean; toggle: () => void }) {
  const p = useProfile(pubkey);
  return (
    <div className="flex items-center gap-3 bg-surface px-4 py-3">
      <Avatar pubkey={pubkey} />
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[15px]">{nameOf(p, pubkey)}</b>
        <span className="line-clamp-1 block text-[13px] text-muted">{p?.about}</span>
      </span>
      <button type="button" className={`btn btn-sm ${on ? "btn-secondary" : "btn-primary"}`} aria-pressed={on} onClick={toggle}>
        {on ? "Following" : "Follow"}
      </button>
    </div>
  );
}

function Option({ icon, title, sub, selected, onClick }: { icon: IconName; title: string; sub: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={selected} className={`flex items-center gap-3 rounded-[14px] border p-3 text-left ${selected ? "border-accent bg-wash" : "border-line"}`} onClick={onClick}>
      <span className="grid size-10 flex-none place-items-center rounded-full bg-raised">
        <Icon name={icon} />
      </span>
      <span>
        <b className="block text-[15px]">{title}</b>
        <span className="block text-[13px] text-muted">{sub}</span>
      </span>
    </button>
  );
}

export function SignIn({ embedded, onDone }: { embedded?: boolean; onDone?: () => void }) {
  const ext = hasExtension();
  const pkOk = passkeySupported();
  const [mode, setMode] = useState<"passkey" | "remote" | "extension" | "key">(ext ? "extension" : pkOk ? "passkey" : "remote");
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<{ uri: string; img: string } | null>(null);

  // nostrconnect:// QR for signer apps (Amber, nsec.app, etc.)
  useEffect(() => {
    if (mode !== "remote") return;
    const ac = new AbortController();
    let session: ReturnType<typeof startNostrConnect> | null = null;
    let connected = false;
    try {
      session = startNostrConnect(ac.signal);
      import("qrcode").then(({ default: QRCode }) => QRCode.toDataURL(session!.uri, { margin: 1, width: 260 })).then((img) => setQr({ uri: session!.uri, img }));
      session.done
        .then(() => {
          connected = true;
          done();
        })
        .catch(() => {});
    } catch {
      /* ignore */
    }
    return () => {
      ac.abort();
      if (!connected) session?.close();
    };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = () => {
    toast("Signed in");
    if (onDone) onDone();
    else closeOnboarding();
  };

  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      if (mode === "passkey") {
        const { sk, credId } = await unlockPasskey();
        loginPasskey(sk, credId);
      } else if (mode === "extension") await loginExtension();
      else if (mode === "remote") {
        if (!/^bunker:\/\//.test(value.trim())) throw new Error("Paste a bunker:// connection from your signer");
        await loginBunker(value);
      } else loginKey(value, password);
      done();
    } catch (e) {
      setErr((e as Error).message || "Couldn't sign in");
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <>
      <h1 className={embedded ? "text-xl font-semibold" : "text-[28px] leading-[34px] font-semibold"}>Sign in</h1>
      <p className="text-[15px] text-muted">Choose how Dusk should sign your notes.</p>
      <div className="grid gap-2" role="radiogroup">
        {pkOk && <Option icon="lock" title="Passkey" sub="Use the passkey you made for Dusk, on this device or synced from another." selected={mode === "passkey"} onClick={() => setMode("passkey")} />}
        <Option icon="key" title="Remote signer" sub="Keep your key on another device. Safest on phones." selected={mode === "remote"} onClick={() => setMode("remote")} />
        <Option icon="server" title="Browser extension" sub={ext ? "Sign with an extension on this computer." : "No extension found in this browser."} selected={mode === "extension"} onClick={() => setMode("extension")} />
        <Option icon="warn" title="Private key" sub="Least safe. Only on a device you trust." selected={mode === "key"} onClick={() => setMode("key")} />
      </div>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {mode === "remote" && (
          <>
            {qr && (
              <div className="grid justify-items-center gap-2 rounded-[14px] border border-line p-4 text-center">
                <img src={qr.img} alt="Scan with your signer app" className="size-[200px] rounded-[10px] bg-white p-2" />
                <span className="caption">Scan with Amber, nsec.app or another signer. Or open it on this device:</span>
                <div className="flex gap-2">
                  <a className="btn btn-secondary btn-sm" href={qr.uri}>
                    Open signer
                  </a>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyText(qr.uri, "Copied connection")}>
                    Copy
                  </button>
                </div>
              </div>
            )}
            <Field label="Or paste a connection" help="bunker://… from your signer app" error={err}>
              <input className="field key" placeholder="bunker://…" autoComplete="off" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
          </>
        )}
        {mode === "extension" && <p className="caption">{ext ? "Dusk will ask your extension for permission." : "Install a Nostr extension such as Alby or nos2x, then reload."}</p>}
        {mode === "key" && (
          <>
            <Warn>Anyone who sees this key can post as you. Dusk keeps it in this browser only, without a password, so use this only on a device you trust.</Warn>
            <Field label="Private key" help="nsec1…, ncryptsec1… or your seed words" error={err}>
              <input className="field key" type="password" placeholder="nsec1…" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
            {value.trim().startsWith("ncryptsec1") && (
              <Field label="Password for this encrypted key">
                <input className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            )}
          </>
        )}
        {mode === "passkey" && <p className="caption">Your device will ask for Face ID, your fingerprint or PIN.</p>}
        {err && (mode === "extension" || mode === "passkey") && <p className="text-[13px] text-clay-ink">{err}</p>}
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy || (mode === "extension" && !ext) || (mode === "remote" && !value.trim()) || (mode === "key" && (!value.trim() || (value.trim().startsWith("ncryptsec1") && !password)))}>
          {busy ? (mode === "passkey" ? "Waiting for passkey…" : "Connecting…") : mode === "passkey" ? "Sign in with passkey" : "Continue"}
        </button>
      </form>
    </>
  );
  if (embedded) return <div className="grid gap-3">{body}</div>;
  return (
    <Shell>
      {body}
      <button type="button" className="btn btn-ghost" onClick={() => useOnb.setState({ step: "welcome" })}>
        Back
      </button>
    </Shell>
  );
}
