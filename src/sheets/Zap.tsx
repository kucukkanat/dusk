import { useEffect, useState } from "react";
import type { NostrEvent } from "applesauce-core/helpers/event";
import QRCode from "qrcode";
import { fetchZapInvoice, payInvoice, hasWallet, canZap, useWallet, getLnurlPay } from "../nostr/zaps";
import { pool, readRelays$, uniqRelays, DEFAULT_RELAYS, eventStore, now } from "../nostr/core";
import { inboxesOf } from "../nostr/relays";
import { useSettings, getSettings } from "../state/settings";
import { openSheet, closeSheet, replaceSheet, toast, errorToast, copyText } from "../state/ui";
import { displayName } from "../nostr/profile";
import { sats } from "../lib/format";
import { Icon } from "../ui/Icon";
import { Avatar, Name } from "../ui/primitives";
import { Link } from "react-router";

export function openZap(o: { pubkey: string; event?: NostrEvent; oneTap?: boolean }) {
  if (!canZap(o.pubkey)) {
    toast(`${displayName(o.pubkey)} can't receive zaps yet`);
    return;
  }
  if (o.oneTap && hasWallet()) {
    const s = getSettings();
    toast(`Zapping ${s.defaultZap} sats…`);
    fetchZapInvoice({ pubkey: o.pubkey, event: o.event, sats: s.defaultZap, comment: s.zapComment })
      .then((pr) => payInvoice(pr))
      .then((ok) => toast(ok ? `Zapped ${s.defaultZap} sats` : "Connect a wallet to zap in one tap"))
      .catch((e) => errorToast(e, "Zap failed"));
    return;
  }
  openSheet(<ZapSheet pubkey={o.pubkey} event={o.event} />, { label: "Zap" });
}

const AMOUNTS = [21, 100, 500, 1000, 5000, 21000];

function ZapSheet({ pubkey, event }: { pubkey: string; event?: NostrEvent }) {
  const def = useSettings((s) => s.defaultZap);
  const wallet = useWallet();
  const [amount, setAmount] = useState(def);
  const [custom, setCustom] = useState("");
  const [comment, setComment] = useState(useSettings.getState().zapComment);
  const [busy, setBusy] = useState(false);
  const value = custom ? Number(custom) : amount;
  // warm the Lightning lookup and their relay list while the amount is being picked
  useEffect(() => {
    getLnurlPay(pubkey).catch(() => {});
    inboxesOf(pubkey, 2500).catch(() => {});
  }, [pubkey]);

  const send = async () => {
    if (!value || value < 1) return;
    setBusy(true);
    try {
      const pr = await fetchZapInvoice({ pubkey, event, sats: value, comment });
      if (hasWallet()) {
        try {
          if (await payInvoice(pr)) {
            closeSheet();
            toast(`Zapped ${sats(value)} sats`);
            return;
          }
        } catch (e) {
          errorToast(e, "Your wallet couldn't pay");
        }
      }
      replaceSheet(<InvoiceView pr={pr} pubkey={pubkey} amount={value} />);
    } catch (e) {
      errorToast(e, "Couldn't get an invoice");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <Avatar pubkey={pubkey} />
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">
            Zap <Name pubkey={pubkey} />
          </h2>
          <p className="caption">{event ? "For this note" : "Directly to their wallet"}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {AMOUNTS.map((a) => (
          <button key={a} type="button" className="chip justify-center" aria-pressed={!custom && amount === a} onClick={() => (setAmount(a), setCustom(""))}>
            <Icon name="zap" size={16} />
            {a >= 1000 ? a / 1000 + "k" : a}
          </button>
        ))}
      </div>
      <input className="field" inputMode="numeric" placeholder="Other amount (sats)" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))} />
      <input className="field" placeholder="Add a comment (optional)" maxLength={200} value={comment} onChange={(e) => setComment(e.target.value)} />
      <button type="button" className="btn btn-zap btn-lg" disabled={busy || !value} onClick={send}>
        <Icon name="zap" />
        {busy ? "Preparing…" : `Zap ${sats(value || 0)} sats`}
      </button>
      {!hasWallet() && (
        <p className="caption text-center">
          No wallet connected: you'll get an invoice to pay with any Lightning wallet.{" "}
          <Link to="/settings/wallet" className="text-accent-ink" onClick={() => closeSheet()}>
            Connect one
          </Link>
        </p>
      )}
      {wallet.balance != null && <p className="caption text-center">Wallet balance: {sats(wallet.balance)} sats</p>}
    </div>
  );
}

function InvoiceView({ pr, pubkey, amount }: { pr: string; pubkey: string; amount: number }) {
  const [qr, setQr] = useState<string>("");
  const [paid, setPaid] = useState(false);
  useEffect(() => {
    QRCode.toDataURL("lightning:" + pr.toUpperCase(), { margin: 1, width: 280 }).then(setQr);
  }, [pr]);
  // watch for the zap receipt that proves payment
  useEffect(() => {
    let sub: { unsubscribe(): void } | null = null;
    inboxesOf(pubkey, 1500).then((inbox) => {
      sub = pool.subscription(uniqRelays(inbox, readRelays$.value, DEFAULT_RELAYS), { kinds: [9735], "#p": [pubkey], since: now() - 60 }).subscribe({
        next: (e) => {
          eventStore.add(e);
          if (e.tags.some((t) => t[0] === "bolt11" && t[1] === pr)) setPaid(true);
        },
        error: () => {},
      });
    });
    return () => sub?.unsubscribe();
  }, [pr, pubkey]);
  if (paid)
    return (
      <div className="grid justify-items-center gap-3 py-6 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-peach text-on-accent">
          <Icon name="zap" size={32} />
        </span>
        <h2 className="text-xl font-semibold">Zapped {sats(amount)} sats</h2>
        <button type="button" className="btn btn-secondary" onClick={() => closeSheet()}>
          Done
        </button>
      </div>
    );
  return (
    <div className="grid justify-items-center gap-3 text-center">
      <h2 className="text-xl font-semibold">Pay {sats(amount)} sats</h2>
      {qr ? <img src={qr} alt="Lightning invoice QR code" className="size-[240px] rounded-[14px] bg-white p-2" /> : <span className="spinner" />}
      <p className="caption">Scan with any Lightning wallet. This closes by itself once paid.</p>
      <div className="grid w-full grid-cols-2 gap-2">
        <button type="button" className="btn btn-secondary" onClick={() => copyText(pr, "Copied invoice")}>
          <Icon name="copy" size={18} />
          Copy
        </button>
        <a className="btn btn-zap" href={"lightning:" + pr}>
          <Icon name="wallet" size={18} />
          Open wallet
        </a>
      </div>
    </div>
  );
}
