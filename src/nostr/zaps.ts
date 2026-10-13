import { create } from "zustand";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { getProfileContent } from "applesauce-core/helpers/profile";
import type { WalletConnect } from "applesauce-wallet-connect";
import { makeZapRequest } from "nostr-tools/nip57";
import { bech32 } from "@scure/base";
import { eventStore, pool, readRelays$, uniqRelays, DEFAULT_RELAYS } from "./core";
import { signEvent, getActivePubkey } from "../state/accounts";
import { inboxesOf } from "./relays";
import { lsGet, lsSet } from "../lib/kv";

export type LnurlPay = { callback: string; minSendable: number; maxSendable: number; allowsNostr?: boolean; nostrPubkey?: string; commentAllowed?: number; lnurl: string };

function lightningAddressOf(pubkey: string): string | undefined {
  const ev = eventStore.getReplaceable(0, pubkey);
  const p = ev ? getProfileContent(ev) : undefined;
  return (p?.lud16 || p?.lud06 || "").trim() || undefined;
}

export function canZap(pubkey: string) {
  return !!lightningAddressOf(pubkey);
}

function lnurlFromAddress(addr: string): { url: string; lnurl: string } | null {
  if (addr.toLowerCase().startsWith("lnurl")) {
    try {
      const { words } = bech32.decode(addr.toLowerCase() as `${string}1${string}`, 2000);
      const url = new TextDecoder().decode(bech32.fromWords(words));
      return { url, lnurl: addr };
    } catch {
      return null;
    }
  }
  const [name, domain] = addr.split("@");
  if (!name || !domain) return null;
  const url = `https://${domain}/.well-known/lnurlp/${name}`;
  return { url, lnurl: bech32.encode("lnurl", bech32.toWords(new TextEncoder().encode(url)), 2000) };
}

const payCache = new Map<string, Promise<LnurlPay>>();

export function getLnurlPay(pubkey: string): Promise<LnurlPay> {
  const addr = lightningAddressOf(pubkey);
  if (!addr) return Promise.reject(new Error("This person hasn't set up a Lightning address"));
  let p = payCache.get(addr);
  if (!p) {
    const target = lnurlFromAddress(addr);
    if (!target) return Promise.reject(new Error("Invalid Lightning address"));
    p = fetch(target.url)
      .then((r) => {
        if (!r.ok) throw new Error(`Their Lightning provider answered ${r.status}`);
        return r.json();
      })
      .then((j) => {
        if (j.status === "ERROR") throw new Error(j.reason || "Lightning provider error");
        return { ...j, lnurl: target.lnurl } as LnurlPay;
      });
    p.catch(() => payCache.delete(addr));
    payCache.set(addr, p);
  }
  return p;
}

/** Build and sign a zap request, then ask the recipient's Lightning provider for an invoice. */
export async function fetchZapInvoice(opts: { pubkey: string; event?: NostrEvent; sats: number; comment?: string }): Promise<string> {
  // their relays are only needed for a nostr zap, but asking alongside the LNURL lookup costs nothing
  const [info, inboxes] = await Promise.all([getLnurlPay(opts.pubkey), getActivePubkey() ? inboxesOf(opts.pubkey, 1500).catch(() => DEFAULT_RELAYS) : DEFAULT_RELAYS]);
  const msats = opts.sats * 1000;
  if (msats < info.minSendable || msats > info.maxSendable)
    throw new Error(`Amount must be between ${Math.ceil(info.minSendable / 1000)} and ${Math.floor(info.maxSendable / 1000)} sats`);
  const params = new URLSearchParams({ amount: String(msats) });
  if (info.allowsNostr && info.nostrPubkey && getActivePubkey()) {
    const relays = uniqRelays(inboxes, readRelays$.value, DEFAULT_RELAYS).slice(0, 6);
    const template = opts.event
      ? makeZapRequest({ event: opts.event as never, amount: msats, comment: opts.comment ?? "", relays })
      : makeZapRequest({ pubkey: opts.pubkey, amount: msats, comment: opts.comment ?? "", relays });
    const signed = await signEvent(template);
    params.set("nostr", JSON.stringify(signed));
    params.set("lnurl", info.lnurl);
  } else if (opts.comment && info.commentAllowed) {
    params.set("comment", opts.comment.slice(0, info.commentAllowed));
  }
  const url = info.callback + (info.callback.includes("?") ? "&" : "?") + params.toString();
  const r = await fetch(url);
  const j = await r.json();
  if (j.status === "ERROR" || !j.pr) throw new Error(j.reason || "No invoice returned");
  return j.pr as string;
}

/* ---------- wallet (Nostr Wallet Connect, with WebLN as a fallback) ---------- */

type WalletState = { uri: string | null; balance: number | null; alias?: string; error?: string };
export const useWallet = create<WalletState>()(() => ({ uri: null, balance: null }));

let wallet: WalletConnect | null = null;
let gen = 0; // bumped on account switch or disconnect so a slow import can't install a stale wallet
// wallet connect is only loaded by people who use it
const nwc = () => import("applesauce-wallet-connect").then(({ WalletConnect }) => ((WalletConnect.pool = pool), WalletConnect));

export function loadWallet(owner: string | null) {
  wallet = null;
  gen++;
  const uri = owner ? lsGet<string | null>("nwc:" + owner, null) : null;
  useWallet.setState({ uri, balance: null, error: undefined, alias: undefined });
  if (uri) connectWallet(uri, false).catch(() => {});
}

export async function connectWallet(uri: string, save = true) {
  const g = ++gen;
  const w = (await nwc()).fromConnectURI(uri.trim());
  if (g !== gen) return;
  wallet = w;
  if (save) {
    const me = getActivePubkey();
    if (me) lsSet("nwc:" + me, uri.trim());
    useWallet.setState({ uri: uri.trim() });
  }
  await refreshBalance();
  try {
    const info = await w.getInfo();
    useWallet.setState({ alias: (info as { alias?: string }).alias });
  } catch {
    /* optional */
  }
}

export async function refreshBalance() {
  if (!wallet) return;
  try {
    const b = await wallet.getBalance();
    useWallet.setState({ balance: Math.floor(b.balance / 1000), error: undefined });
  } catch (e) {
    useWallet.setState({ error: (e as Error).message });
  }
}

export function disconnectWallet() {
  const me = getActivePubkey();
  if (me) lsSet("nwc:" + me, null);
  wallet = null;
  gen++;
  useWallet.setState({ uri: null, balance: null, alias: undefined });
}

export const hasWallet = () => !!wallet || !!(window as { webln?: unknown }).webln;

/** Pay an invoice with the connected wallet. Returns false when there is no wallet to pay with. */
export async function payInvoice(pr: string): Promise<boolean> {
  if (wallet) {
    await wallet.payInvoice(pr);
    refreshBalance();
    return true;
  }
  const webln = (window as { webln?: { enable(): Promise<void>; sendPayment(pr: string): Promise<unknown> } }).webln;
  if (webln) {
    await webln.enable();
    await webln.sendPayment(pr);
    return true;
  }
  return false;
}

export async function zap(opts: { pubkey: string; event?: NostrEvent; sats: number; comment?: string }) {
  const pr = await fetchZapInvoice(opts);
  const paid = await payInvoice(pr);
  return { pr, paid };
}
