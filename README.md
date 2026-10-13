# Dusk

A calm Nostr client. Mobile-first, touch-friendly with swipe actions, and a full desktop layout. Installable as a PWA.

**Live:** https://kucukkanat.github.io/dusk/

Dusk talks to real Nostr relays. It follows the outbox model (NIP-65): each person's notes are read from the relays they publish to, and replies, reactions and zaps are delivered to the relays the other person reads from.

## What's in it

- **Feeds:** following, friends of friends, global, hashtags, a single relay, your lists, long reads, pictures, video. Add, rename and reorder them; pull to refresh; swipe the top bar to switch; new notes wait behind a pill
- **Notes:** replies (NIP-10) and comments (NIP-22), reposts and quotes, reactions with any emoji and your custom emoji (NIP-25, NIP-30), content warnings (NIP-36), blur for media from strangers
- **Swipe actions** on notes (mappable in Settings › Gestures), long-press for the note menu, details with the raw event and where it was seen
- **Composer:** several photos with descriptions and upload progress (Blossom, BUD-02, with `imeta` tags), `@` and `#` autocomplete, polls (NIP-88), content warnings, drafts, quotes
- **Profiles:** banner, website, lightning address, verified addresses (NIP-05), following and followers, badges (NIP-58), QR code, edit your own profile
- **Activity:** mentions, replies, quotes, likes, reposts, zaps and new followers, grouped, with read state and swipe to mute
- **Private messages (NIP-17):** gift-wrapped chats, message requests, encrypted photos, reactions, your message servers (kind 10050)
- **Lists (NIP-51):** private mute list (people, words, tags, threads), private bookmarks, follow sets, follow packs
- **Zaps (NIP-57):** Nostr Wallet Connect (NIP-47), WebLN, or an invoice QR for any wallet; one-tap zaps
- **Sign in:** browser extension (NIP-07), remote signer (NIP-46: `bunker://` or scan a `nostrconnect://` QR with Amber or nsec.app), or a key kept on the device encrypted with a password (NIP-49). Create a new account with 12 seed words (NIP-06). Several identities you can switch between
- **Long reads (NIP-23)** with Markdown, **live streams (NIP-53)** with chat, **calendar events (NIP-52)** with RSVP, **request to vanish (NIP-62)**, reports (NIP-56), deletions (NIP-09), search (NIP-50)
- **Safety:** web-of-trust filtering of replies and activity, mutes everywhere
- **PWA:** offline shell, local cache of notes and profiles (IndexedDB), share target, `web+nostr:` link handler, system notifications while open
- **Accessibility:** text size, higher contrast, reduce motion, data saver, photo description reminders; Night and Dawn themes with six accents

Keyboard on desktop: `j`/`k` move, `l` like, `r` reply, `z` zap, `b` bookmark, `n` new note, `/` search, `[` `]` switch feeds, `g h` / `g a` / `g m` go home, activity, messages, `?` for all shortcuts.

## Develop

```sh
bun install
bun run dev      # Vite dev server
bun run build    # typecheck and build to dist/
bun run preview  # serve dist/
```

To run against a local relay instead of the public ones, set `VITE_RELAYS`:

```sh
VITE_RELAYS=ws://localhost:7777 bun run dev
```

Stack: React 19, TypeScript, Tailwind CSS 4, Vite, [applesauce](https://github.com/hzrd149/applesauce) (event store, relay pool, loaders, signers, actions) and nostr-tools.

| Path | What it is |
| --- | --- |
| `src/index.css` | Dusk design tokens (Night and Dawn) mapped to Tailwind theme colors, plus a few shared component classes |
| `src/nostr/` | Relay pool, event store and cache, outbox timelines, publishing, lists, DMs, zaps, uploads, notifications |
| `src/state/` | Settings, accounts and signers, UI state (sheets, toasts) |
| `src/ui/` | Design system: icons, avatars, rows, sheets, swipe rows, screen layout |
| `src/note/` | Note rendering: rich content, media, kind-specific bodies, actions |
| `src/screens/`, `src/sheets/` | Screens and bottom sheets |

Pushing to `main` builds and deploys to GitHub Pages through `.github/workflows/pages.yml`.

## Privacy notes

- Keys kept on the device are stored encrypted (NIP-49) in local storage and unlocked with your password per session.
- Decrypted direct messages are cached in IndexedDB on this device so they don't need decrypting again. Clear them in Settings › Advanced.
- A Nostr Wallet Connect string is stored in local storage on this device only.
- Link previews are not fetched, so opening a note never contacts the linked site.

## Licence

MIT.
