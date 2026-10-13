import { encode as encodeBlurhash } from "blurhash";
import { getBlossomServersFromList } from "applesauce-common/helpers/blossom";
import { eventStore, now } from "./core";
import { signEvent, getActivePubkey } from "../state/accounts";
import { getSettings } from "../state/settings";

export type Uploaded = { url: string; sha256: string; size: number; type: string; dim?: string; blurhash?: string; alt?: string };

export function mediaServers(): string[] {
  const me = getActivePubkey();
  const ev = me ? eventStore.getReplaceable(10063, me) : undefined;
  const list = ev ? getBlossomServersFromList(ev).map((u) => u.toString()) : [];
  const preferred = getSettings().mediaServer;
  return [...new Set([preferred, ...list].filter(Boolean))].map((s) => s.replace(/\/$/, ""));
}

async function sha256Hex(data: ArrayBuffer) {
  const h = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function imageInfo(file: Blob): Promise<{ dim?: string; blurhash?: string }> {
  if (!file.type.startsWith("image/")) return {};
  try {
    const bmp = await createImageBitmap(file);
    const dim = `${bmp.width}x${bmp.height}`;
    const w = 32;
    const h = Math.max(1, Math.round((bmp.height / bmp.width) * 32));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return { dim };
    ctx.drawImage(bmp, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h);
    return { dim, blurhash: encodeBlurhash(px.data, w, h, 4, 3) };
  } catch {
    return {};
  }
}

/** Upload a file to a Blossom server (BUD-02) with a signed authorization event. */
export async function uploadFile(file: Blob, onProgress?: (p: number) => void, server = mediaServers()[0]): Promise<Uploaded> {
  if (!server) throw new Error("Choose a media server in Settings");
  const buf = await file.arrayBuffer();
  const sha256 = await sha256Hex(buf);
  const auth = await signEvent({
    kind: 24242,
    created_at: now(),
    content: "Upload " + ((file as File).name || "file"),
    tags: [
      ["t", "upload"],
      ["x", sha256],
      ["expiration", String(now() + 600)],
    ],
  });
  const info = await imageInfo(file);
  const res = await new Promise<{ url: string; sha256?: string; size?: number; type?: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", server + "/upload");
    xhr.setRequestHeader("Authorization", "Nostr " + btoa(JSON.stringify(auth)));
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("The media server sent an unexpected answer"));
        }
      } else reject(new Error(xhr.getResponseHeader("X-Reason") || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Couldn't reach the media server"));
    xhr.send(file);
  });
  return { url: res.url, sha256: res.sha256 ?? sha256, size: res.size ?? file.size, type: res.type || file.type, ...info };
}

export function imetaTag(u: Uploaded): string[] {
  const t = ["imeta", `url ${u.url}`, `m ${u.type}`, `x ${u.sha256}`, `size ${u.size}`];
  if (u.dim) t.push(`dim ${u.dim}`);
  if (u.blurhash) t.push(`blurhash ${u.blurhash}`);
  if (u.alt) t.push(`alt ${u.alt}`);
  return t;
}

/** Encrypt a file for a NIP-17 file message (AES-GCM) and upload the ciphertext. */
export async function uploadEncrypted(file: File, onProgress?: (p: number) => void) {
  const key = crypto.getRandomValues(new Uint8Array(32));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const k = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
  const plain = await file.arrayBuffer();
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, k, plain);
  const info = await imageInfo(file);
  const blob = new Blob([ct], { type: "application/octet-stream" });
  const up = await uploadFile(blob, onProgress);
  const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  const tags = [
    ["file-type", file.type || "application/octet-stream"],
    ["encryption-algorithm", "aes-gcm"],
    ["decryption-key", hex(key)],
    ["decryption-nonce", hex(nonce)],
    ["x", up.sha256],
    ["ox", await sha256Hex(plain)],
    ["size", String(file.size)],
  ];
  if (info.dim) tags.push(["dim", info.dim]);
  if (info.blurhash) tags.push(["blurhash", info.blurhash]);
  return { url: up.url, tags };
}

const fromHex = (h: string) => new Uint8Array(h.match(/.{2}/g)!.map((b) => parseInt(b, 16)));

/** Download and decrypt a NIP-17 file message; returns an object URL. */
export async function decryptFile(url: string, keyHex: string, nonceHex: string, type: string) {
  const r = await fetch(url);
  const ct = await r.arrayBuffer();
  const k = await crypto.subtle.importKey("raw", fromHex(keyHex), "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromHex(nonceHex) }, k, ct);
  return URL.createObjectURL(new Blob([pt], { type }));
}
