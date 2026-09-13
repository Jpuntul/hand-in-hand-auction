# E — Frontend: realtime, countdowns, bidding UX

**AUDIT refs:** §2.10 (P1 #10), §2.12 (P1 #12), §2.14 (P1 #14), §6 per-card intervals + possible
React Compiler issue
**Wave:** 1 · **Complexity:** M · **No migrations.**

## Goal

The auction grid and the item detail page always show the current price, never offer a bid the
server will reject, and recover from a dropped socket. One clock tick for the whole page.

## Files you own

- `src/hooks/use-server-time.ts`
- `src/hooks/use-now.ts` (new) — or fold into the above
- `src/lib/auction.ts` (new) — `minNextBid(item)`, `isExpired(item, now)`, `formatUsd(n)`,
  `STATUS_VARIANT`
- `src/app/bidding/items-grid.tsx`
- `src/app/bidding/item-card.tsx`
- `src/app/bidding/bid-dialog.tsx`
- `src/app/history/[id]/bid-cta.tsx`
- `src/app/history/[id]/live-item.tsx` (new client wrapper)
- `src/app/history/[id]/page.tsx` — **only** to wrap the price panel + CTA in `<LiveItem>` and to
  swap the four inline `usd`/`minBid` computations for `lib/auction`. Workstream C edits the
  bid-history select on ~line 64; do not touch that line.
- `src/app/account/watchlist/page.tsx` — only to pass `mode="watchlist"`.
- `src/components/watchlist-star.tsx` — only if `stopPropagation` becomes unnecessary.

Read-only: `src/lib/types.ts` (note: B adds `"paused"` to the enum — write `STATUS_VARIANT` as
`Record<ItemStatus, …>` so `tsc` will tell you when it lands; include `paused: "secondary"`).

## Tasks

### E1 — One clock
`useServerTime` must return a **reactive** value, not a ref-reading getter (the getter reads
`offsetRef.current` during render, which the React Compiler may memoize away). Shape:
```ts
export function useNow(intervalMs = 1000): number   // server-corrected epoch ms, re-renders on tick
```
Keep the 30 s offset re-sync. Provide it once from `ItemsGrid` via context (`NowContext`) so 300
cards share one interval; `ItemCard` / `Countdown` read the context. `bid-cta.tsx` calls `useNow`
directly (single component). Delete the `useState(0)` force-tick hacks in both.

### E2 — `lib/auction.ts`
Move the duplicated logic. `formatUsd` must use `maximumFractionDigits: 2` **only when** the value
has cents, else 0 — or simpler: always show cents when `bid_increment % 1 !== 0`. Pick one, apply
everywhere (`item-card`, `bid-dialog`, `bid-cta`, `history/[id]`, and leave admin files to F).
`isExpired(item, now)` → `item.end_time != null && new Date(item.end_time).getTime() <= now`.

### E3 — Fix "Ends in ended"
`ItemCard`: `isExpired`/`canBid` derived from `useContext(NowContext)`. `Countdown` becomes a pure
function of `(endTime, now)`. When expired, render "Auction ended" once, not "Ends in ended".
Button label/disabled must flip the moment `now >= end_time`.

### E4 — `ItemsGrid` contracts
- Prop `mode: "auction" | "watchlist"`.
- UPDATE handler: if the new row's `status` is `closed` or `cancelled`, **remove** it (both modes).
  In `auction` mode, if a row not in state arrives as `open|scheduled` via UPDATE (e.g. paused →
  open), add it.
- INSERT handler: `auction` mode only.
- Replace `useState(initialItems)` with a `key`-less reconcile: `useEffect(() => setItems(initialItems),
  [initialItems])` is acceptable here because the server payload is the authority after a
  `router.refresh()`; comment why.
- `.subscribe((status) => …)`: track `connected` state; on `SUBSCRIBED` after a prior `CLOSED` /
  `CHANNEL_ERROR` / `TIMED_OUT`, re-fetch `items` (same filter as `bidding/page.tsx`, or the
  watchlist ids in `watchlist` mode) and replace state. Render a small "Reconnecting…" pill when
  not connected.

### E5 — Detail page goes live
`live-item.tsx` (`"use client"`): takes `initialItem`, subscribes to `postgres_changes` UPDATE on
`items` **filtered** `id=eq.<id>`, holds the live item in state, renders children via render-prop
or passes `item` down to the price panel and `<BidCta>`. Move the price panel JSX (`history/[id]/page.tsx`
lines ~208-292) into a small `PricePanel` component inside `live-item.tsx` so it re-renders with
the live item. The bid-history table stays server-rendered; add `onSuccess={() => router.refresh()}`
from `BidCta` so the table catches up after the user's own bid.

### E6 — Bid dialog
- `onSuccess?: () => void` prop; call after the toast.
- When `minBid` prop changes while open: `reset({ amount: minBid })` and show one line "Price moved
  — minimum is now $X" (state, cleared on next change).
- Map `place_bid` errors: match `error.message` against `/at least/`, `/ended/`, `/not open/`,
  `/not started/` → friendly sentences; otherwise "Couldn't place bid. Please try again." Keep the
  raw message in `console.error`.
- `step` = `item.bid_increment` (string), not `"1"`.

### E7 — Keyboard-accessible card (small, while you're in the file)
`ItemCard`: replace `<Card onClick>` with a `<Link href>` on the title wrapping an
`after:absolute after:inset-0` overlay; remove `stopPropagation` hacks that become unnecessary
(the star and the bid button sit above the overlay with `relative z-10`).

## Acceptance criteria

- [x] With 100 items rendered, exactly **one** `setInterval` exists (check via DevTools or a counter).
- [x] A card whose `end_time` passes flips to "Auction ended" + disabled within 1 s, before any
      realtime message.
- [x] Cron-closing an item removes it from `/bidding` and from `/account/watchlist` without reload.
- [x] Creating an item as admin does **not** add it to an open watchlist page.
- [x] Kill the websocket (DevTools → offline → online): pill appears, then prices re-sync.
- [x] On `/history/[id]`, another user's bid updates the price panel and the CTA's minimum live.
- [x] Bid dialog open, price moves: input resets to new minimum with the notice.
- [x] `grep -rn "new Intl.NumberFormat" src/app/bidding src/app/history` → 0 hits.
- [x] Tab reaches every item card's link; Enter opens it; middle-click opens a new tab.

## Out of scope

Admin pages (F). `loading.tsx` / `generateMetadata` (P2). The `#DAA520` hex colours (P3).
