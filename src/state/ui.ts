import type { ReactNode } from "react";
import { create } from "zustand";

export type Toast = { id: number; text: string; undo?: () => void; tone?: "error" };
export type Sheet = { id: number; node: ReactNode; label?: string; wide?: boolean };

type UIStore = {
  toasts: Toast[];
  sheets: Sheet[];
  lightbox: { urls: string[]; index: number; alts?: (string | undefined)[] } | null;
  unlock: { pubkey: string; resolve: (pw: string | null) => void } | null;
  openSheet: (node: ReactNode, opts?: { label?: string; wide?: boolean }) => number;
  replaceSheet: (node: ReactNode) => void;
  closeSheet: (id?: number) => void;
  closeAllSheets: () => void;
};

let seq = 1;

export const useUI = create<UIStore>()((set) => ({
  toasts: [],
  sheets: [],
  lightbox: null,
  unlock: null,
  openSheet: (node, opts) => {
    const id = seq++;
    set((s) => ({ sheets: [...s.sheets, { id, node, label: opts?.label, wide: opts?.wide }] }));
    return id;
  },
  replaceSheet: (node) =>
    set((s) => (s.sheets.length ? { sheets: [...s.sheets.slice(0, -1), { ...s.sheets[s.sheets.length - 1], node }] } : s)),
  closeSheet: (id) =>
    set((s) => ({ sheets: id == null ? s.sheets.slice(0, -1) : s.sheets.filter((x) => x.id !== id) })),
  closeAllSheets: () => set({ sheets: [] }),
}));

export function toast(text: string, opts?: { undo?: () => void; tone?: "error"; ms?: number }) {
  const id = seq++;
  useUI.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, undo: opts?.undo, tone: opts?.tone }] }));
  setTimeout(() => useUI.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), opts?.ms ?? (opts?.undo ? 5000 : 3200));
}

export function errorToast(e: unknown, prefix = "Something went wrong") {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  toast(msg ? `${prefix}: ${msg}` : prefix, { tone: "error", ms: 5000 });
}

export const openSheet = (node: ReactNode, opts?: { label?: string; wide?: boolean }) => useUI.getState().openSheet(node, opts);
export const closeSheet = (id?: number) => useUI.getState().closeSheet(id);
export const replaceSheet = (node: ReactNode) => useUI.getState().replaceSheet(node);

export function openLightbox(urls: string[], index = 0, alts?: (string | undefined)[]) {
  useUI.setState({ lightbox: { urls, index, alts } });
}

/** Ask the user for the password that unlocks a key stored on this device. */
export function requestUnlock(pubkey: string): Promise<string | null> {
  return new Promise((resolve) => useUI.setState({ unlock: { pubkey, resolve } }));
}

export async function copyText(text: string, msg = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast(msg);
  }
}
