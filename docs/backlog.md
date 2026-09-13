# Backlog

Deferred work, in rough priority order. Nothing here is required for an event to run. Items
that depend on an organiser decision reference `open-questions.md`.

## Should do soon

- `cancel_item(item_id, reason)` RPC — `open|paused|scheduled|closed → cancelled`, nulling
  `winner_*` in the same statement (required by the winner CHECK; those columns are not
  client-writable). Until then a *closed* item cannot be cancelled from the UI.
- `profiles.email` sync trigger from `auth.users` (email changes are not propagated today; Edge
  Functions read `auth.users` so nothing is wrong, but the admin users page shows the copy).
- Narrow `src/proxy.ts` matcher to `/admin/:path*` + auth-refresh paths (currently an auth
  round-trip on every request).
- `push_subscriptions` → child table `(endpoint pk, user_id, p256dh, auth, created_at)` instead
  of a read-modify-written JSONB array.
- Startup env validation (Zod) and remove the hard-coded URL fallback in `next.config.ts`.
- Image upload: enforce the 5 MB limit client-side; delete storage objects on remove and on
  item delete/cancel.
- `loading.tsx` for `/bidding`, `/history/[id]`, admin routes; `generateMetadata` (title/OG
  image) on item pages — shared links are the distribution path for a charity auction.
- Generic error messages for the remaining raw PostgREST strings (profile, notifications,
  watchlist actions).

## Nice to have

- `items.winning_bid_id → bid_history.id` set at close / recomputed on cancel (explicit
  winner ↔ bid link for disputes).
- `categories` enum → `text` + CHECK, column renamed `category` (pending OQ-4).
- `useTransition` in the hand-rolled forms (`item-form`, `item-overrides`, `profile-form`,
  `notifications-form`, `watchlist-star`, `admin-toggle`).
- Drop unused deps: `@tanstack/react-query` + devtools + `providers.tsx`, `date-fns`; either
  mount `ThemeProvider` or drop `next-themes` and the `.dark` block.
- Promote `#DAA520` / `#122c7a` to CSS tokens; replace the three `confirm()` calls with
  `<Dialog>`; `/icon-192.png` + `manifest.json` for the iOS home-screen flow.
- Paginate `bid_history` on the detail page; paginate + filter the audit log.
- Accessibility: `aria-pressed` on category filters, `role="timer"` on countdowns, `aria-live`
  on price changes; falsy-check fixes (`item.item_no &&`, `item.retail_value &&`).
- `(select public.is_admin())` wrapping in RLS policies (planner hint).
- Retire `force-dynamic` exports (redundant with `cookies()`).

## Only if an organiser decision requires it

- `events` table + per-event `item_no` uniqueness (OQ-1).
- `paid_at` / `collected_at` on `items` (OQ-6).
- `reassign_winner()` RPC (OQ-7). `anonymise_profile()` (OQ-9).
- Contact requirement (verified email / phone) enforced inside `place_bid` (OQ-5).
