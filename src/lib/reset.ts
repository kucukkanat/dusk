import { closeCache, pool } from "../nostr/core";
import { kvClose } from "./kv";

const deleteDb = (name: string) =>
  new Promise<void>((resolve) => {
    const r = indexedDB.deleteDatabase(name);
    r.onsuccess = r.onerror = r.onblocked = () => resolve();
  });

/** Wipe everything Dusk keeps on this device (accounts, keys, settings, cache, messages, offline files) and reload fresh. */
export async function removeAllData() {
  for (const relay of pool.relays.values()) relay.close();
  await Promise.all([closeCache(), kvClose()]);
  const names = (await indexedDB.databases?.().catch(() => []))?.map((d) => d.name).filter((n): n is string => !!n) ?? [];
  await Promise.all([...new Set([...names, "dusk", "dusk-kv"])].map(deleteDb));
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k))).catch(() => {});
  const regs = (await navigator.serviceWorker?.getRegistrations().catch(() => [])) ?? [];
  await Promise.all(regs.map((r) => r.unregister()));
  location.replace(location.pathname);
}
