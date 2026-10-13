/** A tiny IndexedDB key/value store for things that should stay on this device (decrypted messages, drafts). */
const DB = "dusk-kv";
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbp)
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction("kv", mode);
        const r = fn(t.objectStore("kv"));
        r.onsuccess = () => resolve(r.result as T);
        r.onerror = () => reject(r.error);
      }),
  );
}

export const kvGet = <T>(key: string) => tx<T | undefined>("readonly", (s) => s.get(key)).catch(() => undefined);
export const kvSet = (key: string, value: unknown) => tx<void>("readwrite", (s) => s.put(value, key)).catch(() => {});
export const kvDel = (key: string) => tx<void>("readwrite", (s) => s.delete(key)).catch(() => {});
export const kvClear = () => tx<void>("readwrite", (s) => s.clear()).catch(() => {});

/** localStorage JSON helpers */
export function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem("dusk." + key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
export function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem("dusk." + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}
