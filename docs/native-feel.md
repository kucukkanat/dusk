# Making Dusk feel native

What Dusk does so the installed PWA feels like an app rather than a web page. ★ marks the techniques added most recently.

## Install and launch

- **Web app manifest** (`vite.config.ts`, via `vite-plugin-pwa`): `display: standalone`, name/short name, `theme_color` and `background_color` set to the app background, 192/512 icons plus a **maskable** icon so Android can crop it.
- **iOS home-screen meta** (`index.html`): `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-touch-icon`.
- ★ **Opaque iOS status bar**: `apple-mobile-web-app-status-bar-style: default`, so the app starts below the status bar, which takes its colour from `theme-color`. It used to be `black-translucent` (the app drew under the bar), but iOS 26 broke that for home-screen apps:
  - it lays its Liquid Glass edge blur over the top ~110px, blurring the header, and the page can't measure that area;
  - a WebKit bug makes the reported viewport height come up short by the top inset (~59pt), leaving a gap between the tab bar and the bottom edge.

  Don't switch back to `black-translucent`. iOS reads this tag only when the app is added, so users must remove and re-add the app to pick up a change. The tag is iOS-only, so Android is unaffected; there the system draws a solid status bar coloured by `theme-color`.
- **`viewport-fit=cover`** stays, so content can still run into notches and the home-indicator area and pad itself with `env(safe-area-inset-*)` (see Safe areas). With the opaque bar, the iOS top inset is 0.
- ★ **Launch screens** (`scripts/splash.py` → `public/splash/`, links in `index.html`): `apple-touch-startup-image` for every current iPhone and iPad size, in dark and light variants selected with `prefers-color-scheme`. This replaces the white flash with the logo on the app background. Kept out of the service worker precache (`globIgnores: splash/**`).
- **Share target**: the manifest `share_target` makes Dusk show up in the system share sheet; `useShareTarget` (`App.tsx`) opens the composer with the shared text or URL.
- **Protocol handler**: `web+nostr:` links open in Dusk (`#/open/*`).

## Offline and instant start

- **Service worker** with `registerType: autoUpdate` and `registerSW({ immediate: true })`: the app shell is precached, so it opens offline and updates quietly in the background.
- **SPA fallback** (`navigateFallback: index.html`) and a **hash router**, so any deep link resolves offline.
- **Local event cache** (`nostr/core.ts`, IndexedDB via `nostr-idb`): cached events are loaded into the store before relays answer, so screens render immediately.
- **Device key/value store** (`lib/kv.ts`) for drafts and decrypted messages.
- **Outbox and online state** (`SyncPill.tsx`): posting while offline queues instead of failing, and a small pill shows sync state with retry or drop.
- Large or rare chunks such as HLS are left out of the precache so installs stay small.

## Viewport and page behaviour

- ★ **No page zoom**: `maximum-scale=1, user-scalable=no` in the viewport. iOS ignores that, so `main.tsx` also cancels `gesturestart/change/end` and multi-touch `touchmove` (`passive: false`).
- ★ **No double-tap zoom or 300 ms tap delay**: `touch-action: manipulation` on `html`.
- ★ **No text auto-resizing** on rotate: `text-size-adjust: 100%`.
- ★ **No page rubber-banding**: `overscroll-behavior: none` on `html, body`. The app is a `fixed inset-0` grid with `body { overflow: hidden }`, and only inner panes scroll.
- ★ **Full-height fallback for iOS home-screen apps** (`index.css`): under `@media (display-mode: standalone)` and `@supports (-webkit-touch-callout: none) and (height: 100lvh)`, `html, body` and every full-screen layer marked `data-fill` (app shell, sheets, lightbox, onboarding) get `height: 100lvh; bottom: auto`. This is a backstop in case iOS still reports a short viewport and leaves a gap under the tab bar. `-webkit-touch-callout` is supported only by iOS WebKit, so Android Chrome, desktop browsers and Safari tabs ignore the rule (checked: Chromium returns false for this `@supports` query). When adding a new full-screen `fixed inset-0` layer, give it `data-fill`.
- **Scroll chaining contained**: each screen's scroller uses `overscroll-y-contain`, so reaching the end of a list doesn't bounce the frame around it.
- **Inputs are 16px or larger** (`.field`, search), so iOS never zooms on focus.
- **Theme colour follows the theme** (`useApplySettings`): `meta[name=theme-color]` is rewritten from `--bg` whenever the theme changes, so the system bars always match.
- `color-scheme` is declared so form controls and scrollbars match light or dark.

## Safe areas

- `env(safe-area-inset-*)` on every edge that touches the screen: screen headers (top), the tab bar, sheets, toasts, composer bars in chat, thread and address screens, onboarding, and the lightbox (top and bottom).

## Touch feel

- **No grey tap flash**: `-webkit-tap-highlight-color: transparent`.
- **Pressed states instead of hover**: `.btn:active { scale(0.97) }`, a wash behind `.iconbtn:active`. Tailwind v4 only applies `hover:` on devices that can hover, so hover styles never stick after a tap.
- **44px minimum touch targets** for buttons and icon buttons (52px for large buttons and fields).
- ★ **Chrome isn't text**: buttons, nav, headers, labels, tabs and non-content links get `user-select: none` and `-webkit-touch-callout: none`, so a long press doesn't select UI text or open the link menu. Note bodies (`.prose-note`, `.article-body`) and their links stay selectable.
- ★ Images get `-webkit-user-drag: none`.
- **Haptics**: `navigator.vibrate` when a swipe action commits, on long-press and when dragging dock items. This works on Android; iOS has no web haptics API.
- **Long press** on note rows (500 ms timer, cancelled by movement) opens the note menu.

## Gestures

- ★ **Edge swipe back** (`Screen.tsx`): on pushed screens, a drag starting within 24px of the left edge moves the screen with the finger. It goes back past 35% of the width or on a fast flick, and otherwise springs back. Vertical movement cancels it, so scrolling still works.
- **Pull to refresh** (`Screen.tsx`) on feeds, with damped pull, a "Release to refresh" threshold and a spinner.
- **Swipe actions on rows** (`SwipeRow.tsx`): direction lock (x has to beat y by 1.3×), rubber-band resistance on sides with no action, an icon that grows once the action is armed, and click suppression after a drag.
- **Drag-to-dismiss sheets** (`Overlays.tsx`): drag the grab handle down 120px to close, otherwise the sheet springs back. Uses pointer capture.
- **Swipe the top bar** sideways to switch feeds.
- **Drag to reorder** dock and sidebar items with a grip (pointer events, slight lift `scale(1.02)`).
- ★ **Lightbox gestures** (`ZoomImage` in `Overlays.tsx`): pinch to zoom around the fingers, double-tap to toggle 2.5× at the tap point, pan while zoomed (clamped to the image), swipe sideways to change photo, swipe down to close.
- Double-tap a message to heart it.

## Navigation patterns

- **Bottom tab bar on phones, side rail on wider screens** (`Nav.tsx`), with the overflow in a "More" bottom sheet. Users can edit the dock.
- **Animated tab indicator** (`Slider.tsx`): stretches across the old and new positions, then settles with a springy overshoot. The stretch is capped so long jumps stay a short pill.
- ★ **Tap the active tab again to scroll to the top**.
- **The tab bar hides inside a chat**, the way messaging apps hand the bottom of the screen to the composer.
- **Scroll position remembered per screen** (`scrollMem`), so coming back lands where you left off. Chats open at the bottom.
- **Back falls back to Home** when there is no history, such as after a deep link (`useBack`).
- **Bottom sheets** instead of modals on phones (centred cards on larger screens). Sheets close on navigation, Escape closes the top sheet, and focus moves into the sheet and is restored when it closes.
- **"New notes" pill** instead of pushing content under the reader. Tapping it reveals the new notes and scrolls to the top.
- **Infinite scroll** with an `IntersectionObserver` 800px ahead.
- **Floating compose button** on phones.

## Motion

- One shared easing curve (`--ease-calm`) and roughly 220ms durations: screen fade, push-in, sheet slide-up.
- **Like burst**: the heart pops and small hearts float out.
- **Toasts with Undo** above the tab bar instead of confirmation dialogs.
- **Reduced motion respected**: the system `prefers-reduced-motion` setting plus an in-app toggle (`data-motion="reduce"`) turn animations off.

## Look and system integration

- **Night and Dawn themes** that follow the system by default, accent colours, larger text and a higher-contrast mode, all switched at runtime with CSS variables on `:root`.
- `-webkit-font-smoothing: antialiased` and a single app font (Figtree) with tabular numbers for counts.
- Hidden scrollbars on horizontal chip rows (`.no-scrollbar`).
- **Lazy, async images** (`loading="lazy"`, `decoding="async"`) with fallbacks for broken avatars.
- **Native share sheet** (`navigator.share`) where available, otherwise copy to clipboard.
- **System notifications** through the service worker (`reg.showNotification`), with quiet hours.
- **Right keyboards**: `inputMode="url"` and `"numeric"`, `type="search"`, plus correct `autoComplete` and `spellCheck` on key and password fields.
- Keyboard shortcuts on desktop.

## Regenerating launch screens

When the logo, background colours or device list change, run `python3 scripts/splash.py` (needs Pillow), then replace the `apple-touch-startup-image` links in `index.html` with the ones it prints.
