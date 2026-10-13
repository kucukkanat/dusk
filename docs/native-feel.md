# Making Dusk feel native

What Dusk does so the installed PWA feels like an app rather than a web page. ★ marks the techniques added most recently. Tips for each are under Gotchas at the end.

## Install and launch

- **Web app manifest** (`vite.config.ts`, via `vite-plugin-pwa`): `display: standalone`, name/short name, `theme_color` and `background_color` set to the app background, 192/512 icons plus a **maskable** icon so Android can crop it.
- **iOS home-screen meta** (`index.html`): `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-touch-icon`.
- **Opaque iOS status bar**: `apple-mobile-web-app-status-bar-style: default`, so the app starts below the status bar, which takes its colour from `theme-color`. It used to be `black-translucent` (the app drew under the bar), but iOS 26 broke that for home-screen apps:
  - it lays its Liquid Glass edge blur over the top ~110px, blurring the header, and the page can't measure that area;
  - a WebKit bug makes the reported viewport height come up short by the top inset (~59pt), leaving a gap between the tab bar and the bottom edge.

  Don't switch back to `black-translucent`. iOS reads this tag only when the app is added, so users must remove and re-add the app to pick up a change. The tag is iOS-only, so Android is unaffected; there the system draws a solid status bar coloured by `theme-color`.
- **`viewport-fit=cover`** stays, so content can still run into notches and the home-indicator area and pad itself with `env(safe-area-inset-*)` (see Safe areas). With the opaque bar, the iOS top inset is 0.
- **Launch screens** (`scripts/splash.py` → `public/splash/`, links in `index.html`): `apple-touch-startup-image` for every current iPhone and iPad size, in dark and light variants selected with `prefers-color-scheme`. This replaces the white flash with the logo on the app background. Kept out of the service worker precache (`globIgnores: splash/**`).
- **Share target**: the manifest `share_target` makes Dusk show up in the system share sheet; `useShareTarget` (`App.tsx`) opens the composer with the shared text or URL.
- ★ **Home-screen icon shortcuts** (manifest `shortcuts`): long-press the icon for New note, Search, Messages and Activity. Hash routes work as shortcut URLs; New note uses `./?compose=1`, which `useShareTarget` turns into the composer. The 192px icons are drawn from the app's own icon paths by `scripts/shortcut-icons.mjs`. This works on Android; iOS doesn't support web shortcuts yet.
- ★ **Unread badge on the app icon** (`useAppBadge` in `Nav.tsx`): unread activity (respecting the likes and reposts setting) plus unread messages (not requests) go to `navigator.setAppBadge`, and the badge is cleared at zero. On iOS the badge only appears after notification permission is granted.
- **Protocol handler**: `web+nostr:` links open in Dusk (`#/open/*`).

## Offline and instant start

- **Service worker** with `registerType: autoUpdate` and `registerSW({ immediate: true })`: the app shell is precached, so it opens offline and updates quietly in the background.
- **SPA fallback** (`navigateFallback: index.html`) and a **hash router**, so any deep link resolves offline.
- **Local event cache** (`nostr/core.ts`, IndexedDB via `nostr-idb`): cached events are loaded into the store before relays answer, so screens render immediately.
- **Device key/value store** (`lib/kv.ts`) for drafts and decrypted messages.
- **Outbox and online state** (`SyncPill.tsx`): posting while offline queues instead of failing, and a small pill shows sync state with retry or drop.
- Large or rare chunks such as HLS are left out of the precache so installs stay small.

## Viewport and page behaviour

- **No page zoom**: `maximum-scale=1, user-scalable=no` in the viewport. iOS ignores that, so `main.tsx` also cancels `gesturestart/change/end` and multi-touch `touchmove` (`passive: false`).
- **No double-tap zoom or 300 ms tap delay**: `touch-action: manipulation` on `html`.
- **No text auto-resizing** on rotate: `text-size-adjust: 100%`.
- **No page rubber-banding**: `overscroll-behavior: none` on `html, body`. The app is a `fixed inset-0` grid with `body { overflow: hidden }`, and only inner panes scroll.
- **Full-height fallback for iOS home-screen apps** (`index.css`): under `@media (display-mode: standalone)` and `@supports (-webkit-touch-callout: none) and (height: 100lvh)`, `html, body` and every full-screen layer marked `data-fill` (app shell, sheets, lightbox, onboarding) get `height: 100lvh; bottom: auto`. This is a backstop in case iOS still reports a short viewport and leaves a gap under the tab bar. `-webkit-touch-callout` is supported only by iOS WebKit, so Android Chrome, desktop browsers and Safari tabs ignore the rule (checked: Chromium returns false for this `@supports` query). When adding a new full-screen `fixed inset-0` layer, give it `data-fill`.
- **Scroll chaining contained**: each screen's scroller uses `overscroll-y-contain`, so reaching the end of a list doesn't bounce the frame around it.
- ★ **Keyboard-aware layout** (`lib/keyboard.ts`): the viewport has `interactive-widget=resizes-content`, so Android shrinks the page for the keyboard. iOS keeps the page full height and slides the visible area around instead. So while an input is focused and the visual viewport is more than 120px shorter than the keyboard-free height, the root gets `data-kb`, and every `[data-fill]` layer is pinned to `visualViewport` (`--vv-top`, `--vv-h`). With `data-kb`, the tab bar hides (`.kb-hide`) and `--safe-b` drops to 0, so composers sit directly on the keyboard. After blur, any leftover window scroll is reset.
- ★ **Chats stay pinned to the newest message** (`Screen.tsx`, chat mode): a `ResizeObserver` on the scroller and its content keeps it at the bottom when the keyboard shrinks the scroller or new messages arrive, but only if you were already at the bottom.
- **Inputs are 16px or larger** (`.field`, search), so iOS never zooms on focus.
- **Theme colour follows the theme** (`useApplySettings`): `meta[name=theme-color]` is rewritten from `--bg` whenever the theme changes, so the system bars always match.
- `color-scheme` is declared so form controls and scrollbars match light or dark.

## Safe areas

- ★ Bottom insets go through `--safe-b` (`env(safe-area-inset-bottom)`, or 0 while the keyboard is up) instead of `env()` directly.
- `env(safe-area-inset-*)` on every edge that touches the screen: screen headers (top), the tab bar, sheets, toasts, composer bars in chat, thread and address screens, onboarding, and the lightbox (top and bottom).

## Touch feel

- **No grey tap flash**: `-webkit-tap-highlight-color: transparent`.
- **Pressed states instead of hover**: `.btn:active { scale(0.97) }`, a wash behind `.iconbtn:active`. Tailwind v4 only applies `hover:` on devices that can hover, so hover styles never stick after a tap.
- **44px minimum touch targets** for buttons and icon buttons (52px for large buttons and fields).
- **Chrome isn't text**: buttons, nav, headers, labels, tabs and non-content links get `user-select: none` and `-webkit-touch-callout: none`, so a long press doesn't select UI text or open the link menu. Note bodies (`.prose-note`, `.article-body`) and their links stay selectable.
- Images get `-webkit-user-drag: none`.
- **Haptics**: `navigator.vibrate` when a swipe action commits, on long-press and when dragging dock items. This works on Android; iOS has no web haptics API.
- **Long press** on note rows (500 ms timer, cancelled by movement) opens the note menu.

## Gestures

- **Edge swipe back** (`Screen.tsx`): on pushed screens, a drag starting within 24px of the left edge moves the screen with the finger. It goes back past 35% of the width or on a fast flick, and otherwise springs back. Vertical movement cancels it, so scrolling still works.
- **Pull to refresh** (`Screen.tsx`) on feeds, with damped pull, a "Release to refresh" threshold and a spinner.
- **Swipe actions on rows** (`SwipeRow.tsx`): direction lock (x has to beat y by 1.3×), rubber-band resistance on sides with no action, an icon that grows once the action is armed, and click suppression after a drag.
- **Drag-to-dismiss sheets** (`Overlays.tsx`): drag the grab handle down 120px to close, otherwise the sheet springs back. Uses pointer capture. ★ A quick downward flick (over 0.5px/ms, smoothed) also closes it, and a dismissed sheet carries on off screen before it is removed.
- **Swipe the top bar** sideways to switch feeds.
- **Drag to reorder** dock and sidebar items with a grip (pointer events, slight lift `scale(1.02)`).
- **Lightbox gestures** (`ZoomImage` in `Overlays.tsx`): pinch to zoom around the fingers, double-tap to toggle 2.5× at the tap point, pan while zoomed (clamped to the image), swipe sideways to change photo, swipe down to close.
- Double-tap a message to heart it.

## Navigation patterns

- **Bottom tab bar on phones, side rail on wider screens** (`Nav.tsx`), with the overflow in a "More" bottom sheet. Users can edit the dock.
- **Animated tab indicator** (`Slider.tsx`): stretches across the old and new positions, then settles with a springy overshoot. The stretch is capped so long jumps stay a short pill.
- **Tap the active tab again to scroll to the top**.
- **The tab bar hides inside a chat**, the way messaging apps hand the bottom of the screen to the composer.
- **Scroll position remembered per screen** (`scrollMem`), so coming back lands where you left off. Chats open at the bottom.
- **Back falls back to Home** when there is no history, such as after a deep link (`useBack`).
- **Bottom sheets** instead of modals on phones (centred cards on larger screens). Sheets close on navigation, Escape closes the top sheet, and focus moves into the sheet and is restored when it closes.
- **"New notes" pill** instead of pushing content under the reader. Tapping it reveals the new notes and scrolls to the top.
- **Infinite scroll** with an `IntersectionObserver` 800px ahead.
- **Floating compose button** on phones.

## Motion

- ★ **Shared-element transitions** (`lib/morph.ts`, View Transitions API, so it works in every engine that has it: Chrome/Edge, Safari 18+, Firefox 144+):
  - Avatar → profile header.
  - Photo ↔ lightbox, both ways. Closing morphs back into the thumbnail if it is still on screen and you're on the same photo.
  - Note card → the focused note in its thread.

  `morph(update, { from, key })` gives the source `view-transition-name` and starts the transition. Inside the callback it removes the name from the source and renders the update with `flushSync`. The destination claims the name through a `morphTarget(key)` ref, or `to` for an element already on screen. Names exist only during a transition, so duplicates can't abort it. Without the API, or with reduced motion, `morph` just runs the update. Notes use the `morph-card` name, anchored to the top so text doesn't stretch; avatars and photos use `morph` with `object-fit: cover`.
- ★ **Spring physics** (`--ease-spring`): a damped spring (ζ≈0.62, about 8% overshoot) sampled into a CSS `linear()` easing over `--spring-ms` (460ms). It falls back to `--ease-calm` where `linear()` isn't supported. It's used for sheets opening and snapping back, swipe rows releasing, swipe-back cancelling, the lightbox settling and shared-element morphs. Sheets have a strip of their own colour bleeding below them, so the overshoot never shows a gap.
- ★ **Skeleton loading** (`FeedSkeleton` in `primitives.tsx`): note-shaped shimmer rows replace spinners on Home, Profile, Tag, Lists, Search and Thread (one row for the note itself, two for replies, one at the bottom while paging).
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

## Gotchas

- **View transitions need a synchronous render.** `HashRouter` wraps navigation in `startTransition` by default, which `flushSync` can't flush, so it runs with `useTransitions={false}`. Without that, the new screen isn't in the DOM when the browser takes its snapshot.
- **Never leave a `view-transition-name` on an element.** If two visible elements share one, the transition is skipped. Set names just in time and clear them in `finished`.
- **Unlayered CSS beats Tailwind utilities.** `.skeleton` sets no `border-radius`, so `rounded-full` and `rounded-md` still apply.
- **Spring overshoot moves edges past their resting place.** Anything anchored to the screen edge, such as sheets, needs a bleed so the overshoot doesn't show the page behind it.
- **iOS ignores `interactive-widget`**, which is why the `visualViewport` pinning exists. Android ignores none of it, and the 120px threshold works for both.
- **The app badge needs notification permission on iOS.** Android and desktop show it without permission.
- Shortcut and launch-screen images are generated; regenerate them rather than editing them by hand.

## Regenerating launch screens and shortcut icons

Shortcut icons: `node scripts/shortcut-icons.mjs` (needs Playwright; set `CHROMIUM` to a Chromium path if Playwright has no bundled browser).



When the logo, background colours or device list change, run `python3 scripts/splash.py` (needs Pillow), then replace the `apple-touch-startup-image` links in `index.html` with the ones it prints.
