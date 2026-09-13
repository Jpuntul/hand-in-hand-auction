# Z — Deferred (P2 / P3) — not part of this pass

Kept here so nothing from `AUDIT.md` is lost. Do not start these until A–G are integrated.

## P2

- `revoke execute on all functions in schema public from public` baseline — **done in B3**; verify
  after integration that nothing regressed.
- Narrow `src/proxy.ts` matcher to `/admin/:path*` + auth-refresh paths (§2.20).
- `push_subscriptions` → child table or JSONB path ops (§2.21).
- `useTransition` in the six hand-rolled forms (`item-form`, `item-overrides`, `profile-form`,
  `notifications-form`, `watchlist-star`, `admin-toggle`).
- `loading.tsx` for `/bidding`, `/history/[id]`, admin routes; `generateMetadata` on item pages.
- Delete `@tanstack/react-query` + devtools + `providers.tsx`; delete `date-fns`; mount
  `ThemeProvider` or drop `next-themes` + the `.dark` block.
- Startup env validation (Zod); remove the hardcoded URL fallback in `next.config.ts:3-6`.
- Image upload: `file.size` guard; delete storage object on remove and on item delete/cancel.
- Generic error messages for the remaining raw PostgREST strings (profile, notifications,
  watchlist actions).
- ~~Bid ceiling in `place_bid`~~ — **moved to H4** (`DB_AUDIT.md` DB-5).
- `pauseItem` semantics review once `paused` exists: should `close_expired_auctions` auto-close a
  paused item that expires? (Current decision in B: no.)

- `profiles.email` sync trigger from `auth.users` (DB_AUDIT N1, DB-9) — required before anything
  starts reading `profiles.email` as authoritative (D4).
- `items.winning_bid_id bigint references bid_history(id)` set at close / recomputed on cancel
  (DB_AUDIT N3, DB-19) — makes the winner ↔ bid link explicit for disputes.
- `push_subscriptions` child table (DB_AUDIT N5, DB-14) — same item as §2.21 above, now with a
  schema shape: `(endpoint text primary key, user_id uuid references profiles on delete cascade,
  p256dh text, auth text, created_at timestamptz)`.
- `categories` enum → `text` + `check`, column renamed `category` (DB_AUDIT N7, DB-13) — pending
  OQ-4 (real category list).
- `(select public.is_admin())` wrapping in RLS policies (DB_AUDIT N9) — cosmetic planner hint.
- `events` table + per-event `item_no` uniqueness — **only** if OQ-1 says the database is reused
  for a second event. Do not build speculatively.
- `paid_at` / `collected_at` on `items` — only if OQ-6 says post-event tracking is wanted.

- `cancel_item(item_id, reason)` RPC: `open|paused|scheduled|closed → cancelled`, nulling
  `winner_*` in the same statement (required by `items_winner_only_when_closed`; the columns
  are no longer writable by `authenticated` after H5). Until then, cancel only non-closed items.

## P3

- Promote `#DAA520` / `#122c7a` (22 occurrences) to CSS tokens.
- `/icon-192.png` + `manifest.json`.
- Replace the three `confirm()` calls with `<Dialog>`.
- Paginate `bid_history` on the detail page; paginate + filter the audit log.
- ~~Drop `items_item_no_idx` and `watchlist_user_id_idx`; remove `bid_history` from the realtime publication~~ — **moved to H6**. The duplicate `items_categories_idx` declaration is harmless (`if not exists`); leave it.
- Falsy-check fixes (`item.item_no &&`, `item.retail_value &&`); "Rank" column relabel; winner name
  from `winner_user_id`; filtered item count in the `/bidding` header; `aria-pressed` on category
  filters; `role="timer"` on countdown; `aria-live` region for price changes.
- `ProfileForm` wrapped in a `<form>`; notifications page: email toggle saves on change.
- Retire `force-dynamic` exports (redundant — `cookies()` already makes the routes dynamic).
