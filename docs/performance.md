# Performance

What makes Dusk slow, what we learned finding it, and the rules that keep it fast.
Read this before touching anything in `src/nostr/` or a component that renders per note.

## How the libraries actually behave

These caught us out. Check them before assuming a request is bounded.

- **`timeout` is not a deadline.** `pool.request(..., { timeout })` and `relay.request(..., { timeout })`
  use rxjs `timeout({ first })`. The relay emits an `OPEN` message as soon as the REQ is queued, so the
  timeout is satisfied at once. It only fires when a relay never connects. A request with `timeout: 6000`
  can run for a minute.
- **Group requests finish late by default.** `RelayGroup.request` completes when *all* relays sent EOSE,
  or 5s after the first EOSE. A relay that fails to connect stays "open" through three retries (1s, 2s, 3s),
  so one dead relay holds the whole request for 6–15s.
- **Signature checks happen before duplicate checks.** `EventStore.add` runs `verifyEvent` before it
  notices it already has the event. The same note from 10 relays meant 10 schnorr checks (~1.5ms each on
  a server, 3–5x that on a phone). Events read from IndexedDB come back as structured clones without
  nostr-tools' `verifiedSymbol`, so they were all checked again.
- **`eventStore.update$` fires for almost every duplicate.** Adding a copy from a new relay updates
  "seen relays" and emits on `update$`. Anything subscribed to `update$` re-renders on every WebSocket
  message.
- **`pool.request(..., { eventStore })` already adds events to the store.** Adding them again in `next`
  repeats the bookkeeping.
- **`ActionRunner` caches its context (the signed-in user) forever.** After switching accounts it read
  account A's lists and published them as account B. Make a runner per account.
- **The missing-event loader tries its sources one after another** (cache → hints → read relays → lookup
  relays), each waiting for the previous to complete.
- **nostr-idb reads every match before applying `limit`,** unless the filter has `since`/`until`. It
  indexes every single-letter tag, so one follow list with 1,000 `p` tags makes 1,000 index rows. Its
  default cap is 10,000 events, pruned by last *write*.
- **Relays cap concurrent subscriptions** (strfry defaults to 20 per connection). Extra REQs are closed
  with an error, which looks like "no results".

## Rules

### Network

- Use `quick()` / `quick$()` from `src/nostr/core.ts` for one-shot reads. They skip unhealthy relays,
  finish shortly after the first relay answers, and always end by a hard cap. Don't call
  `pool.request` with the default completion for anything a user waits on.
- Filter relay lists through `healthy()` (backed by `RelayLiveness`) so dead relays from other people's
  lists aren't dialled on every request.
- Never block first paint on a relay-list (kind 10002) lookup. Start on read/default relays and add outbox
  relays as they arrive. Remember people who have no relay list so they aren't looked up every launch.
- Close what you open. Page requests must be unsubscribed once the page settles.
- Don't refetch what's already live: the session keeps your own lists current, so edits trust the store
  once it has synced (including "you have no such list").
- Ask for heavy things only when they're shown: other people's follow lists (kind 3) are 10–100KB each.
  Never fetch a profile's followers on open; count them (NIP-45) or load them when the sheet opens.
- Share expensive work: one in-flight download per set of contact lists, one friends-of-friends result
  reused by the feed, Search, Discover and web of trust.
- Use `since` for anything fetched every launch (DMs, notifications) instead of re-downloading history.
- Keep heavy kinds out of filters that share a limit with light ones (follow lists crowd out replies,
  reactions crowd out mentions).

### Writes

- `publish()` returns once the event is signed and in the store; relays are tried in the background and
  failures show in the sync pill. Only await `.sent` when the user must know a relay accepted it.
- List events (3, 10000, 10002, 10003, 10050, 30000) never notify tagged people.
- Show the result before the signer answers when you can (pending like, pending follow).

### Rendering

- Never subscribe to `eventStore.update$` from a per-note component. Filter to the event you care about.
- Anything derived from a big list (follow set, web of trust, notifications, conversations, engagement)
  is computed once in a shared store, not in every component that needs it.
- Select single fields from zustand stores; never call `useSettings()` or `useNotifRead()` bare in a row.
- Long lists render only what's near the viewport.
- No layout reads in render or in effects that run every render. Measure once per item.
- Cache decoded blurhashes; don't decode in render.
- Touch listeners that call `preventDefault` block scrolling. Add them only for the gesture that needs them.

### Startup

- Screens other than Home are lazy-loaded. Heavy libraries (qrcode, marked, dompurify, wallet connect,
  hls) load when first used.
- Events read from the cache are marked verified and from-cache, so they are neither re-checked nor
  re-written.
- Only cache what makes the next start fast: your own lists, profiles, relay lists, notes. Not other
  people's follow lists or the reaction firehose.
- Decrypting DMs happens in small batches that yield to the browser, after first paint.
