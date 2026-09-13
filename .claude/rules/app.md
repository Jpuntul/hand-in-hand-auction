---
paths:
  - "src/**"
---

# App rules (src/**)

- Formatting is Biome's (tabs, double quotes, organized imports). Run `pnpm biome check --write src`
  rather than hand-formatting.
- Admin server actions: first statement `await requireAdmin()` wrapped to return
  `{ ok: false, error: "Forbidden" }`; mutations `.select("id")` and treat `[]` as failure; audit
  via `supabase.rpc("log_audit", …)` after the confirmed mutation (action names `admin.<area>.<verb>`).
- Item lifecycle from the UI: details form → `updateItem` (details only); schedule card →
  `updateItemSchedule` (`scheduled | open | paused` only); everything else → override RPCs
  (`pause_item`, `resume_item`, `extend_deadline`, `force_close_item`, `cancel_last_bid`). Never
  send `current_*`, `bid_count`, `winner_*` from the client — Postgres rejects it (42501).
- Prices: `formatUsd` from `src/lib/auction.ts`; minimum next bid: `minNextBid(item)`; expiry:
  `isExpired(item, now)` with `now` from `useNow()` / `NowContext` — do not create new
  `setInterval`s per component.
- Realtime: subscribe to `items` only (`bid_history` is not published). Drop closed/cancelled rows
  on UPDATE; re-fetch after a reconnect.
- Bid history reads: `order("id", { ascending: false })`, embed
  `bidder:public_profiles!user_id(display_name)`, and show cancelled rows struck through.
- Env access through `getEnv()` (`src/lib/env.ts`); no non-null assertions on `process.env`.
- Types come from `src/lib/supabase/database.types.ts`; no `as any` or local copies of table/RPC
  types — regenerate instead.
- `components/ui/` is vendored shadcn: do not edit; wrap or add a `biome-ignore` with a reason.
