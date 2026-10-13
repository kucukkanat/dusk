import { memo, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { use$ } from "applesauce-react/hooks";
import type { NostrEvent } from "applesauce-core/helpers/event";
import { getParsedContent } from "applesauce-content/text";
import type { Content as Node } from "applesauce-content/nast";
import { getMediaAttachments, type FileMetadataFields } from "applesauce-common/helpers/file-metadata";
import { decode as decodeBlurhash } from "blurhash";
import { eventStore } from "../nostr/core";
import { useProfile, nameOf } from "../nostr/profile";
import { profilePath, tagPath, eventPath } from "../lib/links";
import { hostOf } from "../lib/format";
import { openLightbox, copyText } from "../state/ui";
import { useSettings } from "../state/settings";
import { Icon } from "../ui/Icon";
import { Avatar } from "../ui/primitives";
import { ago } from "../lib/format";

const IMAGE = /\.(jpe?g|png|gif|webp|avif|heic|svg)(\?.*)?$/i;
const VIDEO = /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i;
const AUDIO = /\.(mp3|ogg|wav|m4a|flac|opus)(\?.*)?$/i;

export function mediaKind(url: string, type?: string): "image" | "video" | "audio" | null {
  if (type?.startsWith("image/")) return "image";
  if (type?.startsWith("video/")) return "video";
  if (type?.startsWith("audio/")) return "audio";
  const path = url.split("#")[0];
  if (IMAGE.test(path)) return "image";
  if (VIDEO.test(path)) return "video";
  if (AUDIO.test(path)) return "audio";
  return null;
}

function useImeta(event?: NostrEvent) {
  return useMemo(() => {
    const m = new Map<string, FileMetadataFields>();
    if (event) for (const a of getMediaAttachments(event)) if (a.url) m.set(a.url, a);
    return m;
  }, [event]);
}

/** Decoded blurhashes as tiny data URLs, most recently used last. */
const blurCache = new Map<string, string | undefined>();
function blurUrl(hash?: string) {
  if (!hash) return undefined;
  if (blurCache.has(hash)) {
    const v = blurCache.get(hash);
    blurCache.delete(hash);
    blurCache.set(hash, v);
    return v;
  }
  let url: string | undefined;
  try {
    const px = decodeBlurhash(hash, 16, 16);
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(16, 16);
    img.data.set(px);
    ctx.putImageData(img, 0, 0);
    url = c.toDataURL();
  } catch {
    url = undefined;
  }
  blurCache.set(hash, url);
  if (blurCache.size > 200) blurCache.delete(blurCache.keys().next().value!);
  return url;
}

/** Images and video, with blur placeholders and a tap-to-load guard for strangers and content warnings. */
export function MediaGrid({ urls, meta, hidden, onReveal }: { urls: string[]; meta: Map<string, FileMetadataFields>; hidden?: boolean; onReveal?: () => void }) {
  const dataSaver = useSettings((s) => s.dataSaver);
  const [loaded, setLoaded] = useState(!dataSaver);
  const images = urls.filter((u) => mediaKind(u, meta.get(u)?.type) === "image");
  const others = urls.filter((u) => mediaKind(u, meta.get(u)?.type) !== "image");
  if (!urls.length) return null;
  const blocked = hidden || !loaded;
  const firstMeta = meta.get(images[0] ?? urls[0]);
  const blur = blocked ? blurUrl(firstMeta?.blurhash) : undefined;
  const ratio = (() => {
    const d = firstMeta?.dimensions?.split("x").map(Number);
    return d && d[0] && d[1] ? Math.min(1.6, Math.max(0.6, d[1] / d[0])) : 0.75;
  })();
  if (blocked)
    return (
      <button
        type="button"
        className="relative mt-3 block w-full overflow-hidden rounded-[14px] bg-raised"
        style={{ aspectRatio: images.length === 1 ? `1 / ${ratio}` : "16 / 9" }}
        onClick={(e) => {
          e.stopPropagation();
          setLoaded(true);
          onReveal?.();
        }}
      >
        {blur && <img src={blur} alt="" decoding="async" className="absolute inset-0 size-full object-cover" />}
        <span className="absolute inset-0 grid place-items-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-bg/80 px-4 py-2 text-[14px] font-medium">
            <Icon name={hidden ? "eyeoff" : "image"} size={18} />
            {hidden ? "Show media" : `Load ${urls.length === 1 ? "media" : urls.length + " items"}`}
          </span>
        </span>
      </button>
    );
  return (
    <div className="mt-3 grid gap-1" onClick={(e) => e.stopPropagation()}>
      {images.length === 1 && <Img url={images[0]} meta={meta.get(images[0])} ratio={ratio} onOpen={(el) => openLightbox(images, 0, images.map((u) => meta.get(u)?.alt), el)} />}
      {images.length > 1 && (
        <div className={`grid gap-1 overflow-hidden rounded-[14px] ${images.length === 2 ? "grid-cols-2" : "grid-cols-2"}`}>
          {images.slice(0, 4).map((u, i) => (
            <button key={u} type="button" className="relative aspect-square overflow-hidden bg-raised" onClick={(e) => openLightbox(images, i, images.map((x) => meta.get(x)?.alt), e.currentTarget)}>
              <img src={u} alt={meta.get(u)?.alt ?? ""} loading="lazy" decoding="async" className="size-full object-cover" />
              {i === 3 && images.length > 4 && <span className="absolute inset-0 grid place-items-center bg-black/50 text-xl font-semibold text-white">+{images.length - 4}</span>}
            </button>
          ))}
        </div>
      )}
      {others.map((u) =>
        mediaKind(u, meta.get(u)?.type) === "audio" ? (
          <audio key={u} src={u} controls preload="none" className="w-full" />
        ) : (
          <video key={u} src={u} controls playsInline preload="none" poster={meta.get(u)?.thumbnail ?? meta.get(u)?.image} className="max-h-[70vh] w-full rounded-[14px] bg-black" />
        ),
      )}
    </div>
  );
}

function Img({ url, meta, ratio, onOpen }: { url: string; meta?: FileMetadataFields; ratio: number; onOpen: (el: Element) => void }) {
  const [ok, setOk] = useState(true);
  const [done, setDone] = useState(false);
  const blur = useMemo(() => blurUrl(meta?.blurhash), [meta?.blurhash]);
  if (!ok)
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block rounded-[14px] border border-line p-3 text-[14px] text-muted">
        Image unavailable · {hostOf(url)}
      </a>
    );
  return (
    <button
      type="button"
      onClick={(e) => onOpen(e.currentTarget)}
      className="relative block w-full overflow-hidden rounded-[14px] bg-raised"
      // without known dimensions, hold a 4:3 box until the image arrives so the feed doesn't jump as much
      style={meta?.dimensions ? { aspectRatio: `1 / ${ratio}` } : done ? undefined : { aspectRatio: "4 / 3" }}
    >
      {blur && !done && <img src={blur} alt="" decoding="async" className="absolute inset-0 size-full object-cover" />}
      <img src={url} alt={meta?.alt ?? ""} loading="lazy" decoding="async" onLoad={() => setDone(true)} onError={() => setOk(false)} className={`relative max-h-[75vh] w-full ${meta?.dimensions ? "h-full object-cover" : done ? "object-contain" : "h-full object-contain"}`} />
      {meta?.alt && <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 text-[11px] font-semibold text-white">ALT</span>}
    </button>
  );
}

export function LinkCard({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()} className="mt-3 flex items-center gap-3 rounded-[14px] border border-line p-3 transition-colors hover:bg-wash">
      <Icon name="link" className="text-muted" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{hostOf(url)}</span>
        <span className="block truncate text-[13px] text-muted">{url.replace(/^https?:\/\//, "")}</span>
      </span>
    </a>
  );
}

function MentionName({ pubkey }: { pubkey: string }) {
  const p = useProfile(pubkey);
  return (
    <Link to={profilePath(pubkey)} className="font-medium text-accent-ink" onClick={(e) => e.stopPropagation()}>
      @{nameOf(p, pubkey)}
    </Link>
  );
}

/** A quoted note, article or other event referenced from content. */
export function EmbeddedEvent({ pointer, depth = 0 }: { pointer: string | { id: string; relays?: string[] } | { kind: number; pubkey: string; identifier: string; relays?: string[] }; depth?: number }) {
  const pkey = useMemo(() => (typeof pointer === "string" ? pointer : JSON.stringify(pointer)), [pointer]);
  const ev = use$(() => eventStore.event(pointer as never), [pkey]);
  const nav = useNavigate();
  const profile = useProfile(ev?.pubkey);
  if (!ev)
    return (
      <div className="mt-3 rounded-[14px] border border-line p-3 text-[14px] text-muted" onClick={(e) => e.stopPropagation()}>
        <span className="spinner mr-2 inline-block size-3.5 align-middle" /> Loading quoted note…
      </div>
    );
  const title = ev.kind === 30023 ? ev.tags.find((t) => t[0] === "title")?.[1] : undefined;
  return (
    <div
      role="link"
      tabIndex={0}
      className="mt-3 block cursor-pointer rounded-[14px] border border-line p-3 text-left transition-colors hover:bg-wash"
      onClick={(e) => {
        e.stopPropagation();
        nav(eventPath(ev));
      }}
      onKeyDown={(e) => e.key === "Enter" && nav(eventPath(ev))}
    >
      <span className="flex items-center gap-2 text-[13px] text-muted">
        <Avatar pubkey={ev.pubkey} size="xs" profile={profile ?? null} />
        <span className="truncate font-semibold text-ink">{nameOf(profile, ev.pubkey)}</span>
        <span>· {ago(ev.created_at)}</span>
      </span>
      {title ? (
        <>
          <span className="mt-1 flex items-center gap-1 text-[13px] text-muted">
            <Icon name="book" size={16} /> Long read
          </span>
          <span className="mt-1 block text-[17px] leading-6 font-semibold">{title}</span>
        </>
      ) : (
        <div className="prose-note mt-1 line-clamp-6 text-[15px] leading-[22px]">
          {depth < 1 ? <RichText event={ev} depth={depth + 1} inline /> : ev.content.slice(0, 280)}
        </div>
      )}
    </div>
  );
}

/** Render a note's text: mentions, hashtags, links, custom emoji and media. */
export const RichText = memo(function RichText({ event, content, depth = 0, inline, hideMedia, blurMedia }: { event: NostrEvent; content?: string; depth?: number; inline?: boolean; hideMedia?: boolean; blurMedia?: boolean }) {
  const meta = useImeta(event);
  const nodes = useMemo(() => getParsedContent(event, content).children as Node[], [event, content]);
  const { parts, media, embeds, links } = useMemo(() => buildParts(nodes, meta, depth, hideMedia), [nodes, meta, depth, hideMedia]);
  if (inline) return <>{parts}</>;
  return (
    <>
      {parts.length > 0 && <div className="prose-note">{parts}</div>}
      {!hideMedia && <MediaGrid urls={media} meta={meta} hidden={blurMedia} />}
      {embeds}
      {!media.length && !embeds.length && links.length > 0 && depth === 0 && <LinkCard url={links[links.length - 1]} />}
    </>
  );
});

function buildParts(nodes: Node[], meta: Map<string, FileMetadataFields>, depth: number, hideMedia?: boolean) {
  const media: string[] = [];
  const embeds: ReactNode[] = [];
  const links: string[] = [];
  const parts: ReactNode[] = [];
  nodes.forEach((n, i) => {
    switch (n.type) {
      case "text":
        parts.push(n.value);
        break;
      case "hashtag":
        parts.push(
          <Link key={i} to={tagPath(n.hashtag)} className="font-medium text-accent-ink" onClick={(e) => e.stopPropagation()}>
            #{n.name}
          </Link>,
        );
        break;
      case "emoji":
        parts.push(<img key={i} src={n.url} alt={n.raw} title={n.code} className="inline-block h-[1.3em] w-auto align-[-0.25em]" loading="lazy" decoding="async" />);
        break;
      case "gallery":
        media.push(...n.links);
        break;
      case "link": {
        const kind = mediaKind(n.href, meta.get(n.href)?.type);
        if (kind && !hideMedia) media.push(n.href);
        else {
          const label = n.value.replace(/^https?:\/\/(www\.)?/, "");
          parts.push(
            <a key={i} href={n.href} target="_blank" rel="noreferrer noopener" className="font-medium text-accent-ink" onClick={(e) => e.stopPropagation()}>
              {label.slice(0, 48)}
              {label.length > 48 ? "…" : ""}
            </a>,
          );
          if (!kind) links.push(n.href);
        }
        break;
      }
      case "mention": {
        const d = n.decoded;
        if (d.type === "npub") parts.push(<MentionName key={i} pubkey={d.data} />);
        else if (d.type === "nprofile") parts.push(<MentionName key={i} pubkey={d.data.pubkey} />);
        else if (d.type === "note") embeds.push(depth < 2 ? <EmbeddedEvent key={i} pointer={d.data} depth={depth} /> : null);
        else if (d.type === "nevent") embeds.push(depth < 2 ? <EmbeddedEvent key={i} pointer={d.data} depth={depth} /> : null);
        else if (d.type === "naddr") embeds.push(depth < 2 ? <EmbeddedEvent key={i} pointer={d.data} depth={depth} /> : null);
        else parts.push(n.encoded);
        break;
      }
      case "blossom":
        parts.push(n.raw);
        break;
      default: {
        const anyN = n as { type: string; raw?: string; value?: string };
        if (anyN.type === "lightning" || anyN.type === "cashu")
          parts.push(
            <button key={i} type="button" className="chip my-1 text-[13px]" onClick={(e) => (e.stopPropagation(), copyText(anyN.raw ?? "", anyN.type === "cashu" ? "Copied ecash token" : "Copied invoice"))}>
              <Icon name={anyN.type === "cashu" ? "wallet" : "zap"} size={16} />
              {anyN.type === "cashu" ? "Ecash token" : "Lightning invoice"} · copy
            </button>,
          );
        else parts.push(anyN.raw ?? anyN.value ?? "");
      }
    }
  });
  // trim trailing whitespace left behind by media links at the end
  while (parts.length && typeof parts[parts.length - 1] === "string" && !(parts[parts.length - 1] as string).trim()) parts.pop();
  if (typeof parts[parts.length - 1] === "string") parts[parts.length - 1] = (parts[parts.length - 1] as string).trimEnd();
  // imeta-only media (e.g. kind 20 pictures)
  for (const u of meta.keys()) if (!media.includes(u) && mediaKind(u, meta.get(u)?.type)) media.push(u);
  return { parts, media, embeds, links };
}
