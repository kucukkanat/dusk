# Dusk

A calm Nostr client. Mobile-first, touch-friendly with swipe actions, and a full desktop layout. Installable as a PWA.

**Live:** https://kucukkanat.github.io/dusk/

> This is a clickable prototype. Every person, note and message is sample data, and nothing is sent to relays yet. Settings and drafts are kept in your browser.

## What's in it

- **Feeds** you can add, rename and reorder; pull to refresh; swipe the top bar to switch feeds
- **Swipe actions** on notes (mappable in Settings › Gestures), long-press for the note menu
- **Reactions** with any emoji and custom emoji, and a list of who reacted
- **Rich content:** `nostr:` mentions and embeds, link previews, galleries, video, blurred placeholders, alt text
- **Composer:** several photos with descriptions and upload progress, media server choice, `@` and `#` autocomplete, polls, drafts
- **Profiles:** banner, website, lightning address, verified address checks, following and followers, badges, QR code
- **Lists (NIP-51):** private mute list, bookmarks, follow sets, follow packs
- **Private messages (NIP-17):** chats and message requests, photos, reactions, inbox servers
- **Safety:** web-of-trust filtering, reports, muted threads
- **Signers:** browser extension, remote signer with permissions, Amber, encrypted key export (NIP-49)
- **Zaps** with a Lightning wallet, and **multiple identities** you can switch between
- **PWA:** offline shell, share target, `web+nostr:` link handler, install button, push notification flow
- **Accessibility:** text size, higher contrast, reduce motion, data saver, photo description reminders
- **Extras:** live streams with chat, calendar events with RSVP, badges, request to vanish

Keyboard on desktop: `j`/`k` move, `l` like, `r` reply, `z` zap, `n` new note, `[` `]` switch feeds, `?` for all shortcuts.

## Develop

```sh
bun run check   # syntax check
bun run build   # writes dist/
bun run dev     # build and serve dist/ locally
```

The app is plain HTML, CSS and JavaScript with no dependencies:

| Path | What it is |
| --- | --- |
| `src/index.html` | App shell |
| `src/css/tokens.css` | Dusk design tokens (Night and Dawn themes) |
| `src/css/dusk.css`, `src/js/dusk.js` | Dusk design system components |
| `src/css/app.css`, `src/js/app.js` | The client |
| `src/sw.js` | Service worker; the build stamps its version and precache list |
| `src/manifest.webmanifest` | PWA manifest |

Pushing to `main` builds and deploys to GitHub Pages through `.github/workflows/pages.yml`.

## Licence

MIT. Bundles [qrcodejs](https://github.com/davidshimjs/qrcodejs) (MIT).
