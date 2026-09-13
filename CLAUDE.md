# Hand in Hand Charity Auction

Real-time silent-auction web app for one charity evening. Next.js 16 (App Router, React 19
Compiler, Tailwind v4, shadcn/Base UI) + Supabase (Postgres 17, RLS, pg_cron, Realtime, Storage,
Edge Functions). Package manager is **pnpm**.

## The one architectural rule

**All auction money logic lives in Postgres; RLS is the security boundary.** The browser talks to
Supabase directly with the anon key + user JWT. The app never computes a winner, a current bid,
or a bid count — `place_bid()`, the admin override RPCs, and the cron functions do, under a row
lock. Server actions exist only for admin/account forms and must start with `requireAdmin()` /
an auth check. If you find yourself writing bid arithmetic in TypeScript, stop.

Read `docs/database.md` before touching anything under `supabase/` — it is the map of the schema,
the invariants, the RPC surface, and the access matrix.

## Commands

```bash
pnpm dev                          # Next.js dev server
pnpm exec supabase start          # local stack (Docker); db on 127.0.0.1:54322
pnpm exec supabase db reset       # rebuild local DB from supabase/migrations (never --linked)
pnpm exec supabase test db        # pgTAP suite in supabase/tests/
pnpm test                         # vitest
pnpm biome check src              # lint + format (tabs, double quotes)
pnpm tsc --noEmit                 # typecheck
pnpm build                        # production build
pnpm exec supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

Definition of done for any change: biome clean, tsc clean, vitest green, build green; DB changes
also need `supabase test db` green. CI runs all of these plus a migration drift gate.

## Where things are

```text
src/app/                 routes: bidding/, history/[id]/ (item detail), account/, admin/(protected)/
src/lib/auth/            requireAdmin, safeRedirectPath, shared Zod schemas, cached server queries
src/lib/auction.ts       minNextBid / isExpired / formatUsd / STATUS_VARIANT — the only place
src/lib/env.ts           getEnv() — no `process.env.X!` anywhere
src/hooks/use-now.ts     server-corrected clock (NowContext) — one interval per page
supabase/migrations/     4 baseline files (schema, functions, rls, ops). Never edit; add on top.
supabase/functions/      Edge Functions (secret-gated webhooks) + _shared/
supabase/tests/          pgTAP tests — every DB invariant has one
docs/                    database.md (ERD + contracts), open-questions.md, backlog.md
notes/                   changelog of significant changes and decisions (see rules)
```

## Conventions

- Server actions return `{ ok: true, ... } | { ok: false, error: string }`; never leak raw
  PostgREST error strings to the UI when a friendly message exists.
- Mutations under RLS use `.select("id")` and treat zero rows as failure.
- Money is `numeric(12,2)` in the DB and formatted only via `formatUsd`. No `new Intl.NumberFormat`
  in route files.
- Bid order is `order by id`, never `created_at`. A "live" bid is `cancelled_at is null`.
- Generated types are the source of truth: after any schema change regenerate
  `database.types.ts`; do not hand-write table/RPC types.
- Secrets: `.env.local` is never read or printed. The service-role key is used only by Edge
  Functions (Supabase-injected) — never in the Next.js app or Vercel.
- Commits: conventional prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`). The owner commits;
  do not commit or push unless asked. Never force-push `main`.

## Non-negotiables (enforced by DB, do not work around)

- `bid_history` is append-only: no deletes, cancellation sets `cancelled_*` via `cancel_last_bid`.
- `items.current_bid / current_bidder_id / bid_count / winner_user_id / winning_bid` are not
  client-writable. Need to change them? Write or extend a `SECURITY DEFINER` function, lock the
  row, audit in-transaction, add a pgTAP test.
- Every new function needs an explicit `grant execute` (defaults revoke it from `public`/`anon`).
- Every new `profiles`/`items` column that bidders may edit needs an explicit column `grant update`
  (table-level UPDATE is revoked from `authenticated`).

Skills: `/db-change` (schema change procedure), `/verify` (run all checks), `/pre-event-check`
(production readiness before the auction night).
