# G — Tests, CI, error tracking, signup confirmation, docs

**AUDIT refs:** §7 (P1 #19), §8 (P1 #18, #20), §5 #9 docs drift
**Wave:** 3 (after A and B) · **Complexity:** M · **New dev dependencies allowed:** `vitest`,
`@sentry/nextjs` (via wizard), and whatever the SQL test runner needs (`pgtap` is in the Supabase
image; no npm dep).

## Goal

The five guarantees most expensive to get wrong have regression tests that run in CI. Errors in
production are visible. Signup works with email confirmation enabled. Docs describe the code.

## Files you own

- `.github/workflows/ci.yml` (new)
- `vitest.config.ts` (new), `package.json` (scripts + devDeps only)
- `src/**/*.test.ts` (new)
- `supabase/tests/*.sql` (new)
- `sentry.*.config.ts`, `instrumentation.ts`, `next.config.ts` (Sentry wrapping only),
  `src/app/error.tsx`, `src/app/global-error.tsx` (new)
- `src/lib/auth/actions.ts` — **only** `signUpBidder`'s success path
- `src/app/login/login-form.tsx` — **only** the signup success state
- `README.md`, `ADMIN_SETUP.md`, `DEPLOY.md` (Sentry section + branch name)

## Tasks

### G1 — SQL tests (`supabase/tests/`)
Runnable via `supabase test db` (pgTAP). One file each:
1. `place_bid_concurrency.sql` — seed an open item; use `dblink` or two sessions if available,
   else simulate with `pg_advisory` ordering. Assert after N bids: `bid_count = N`, `current_bid =
   max(amount)`, `current_bidder_id = user of max`. If true concurrency isn't achievable in pgTAP,
   write a Vitest test instead that fires 20 parallel `rpc("place_bid")` calls against local
   Supabase and asserts the same — and say which you did.
2. `rls_matrix.sql` — for roles `anon`, bidder A, bidder B, admin (`set local role` +
   `request.jwt.claims`): assert `profiles` returns own row only / all for admin; `public_profiles`
   has no `email`; `audit_log` unreadable by bidders; `items` update by bidder affects 0 rows;
   `log_audit` as anon raises.
3. `anti_snipe.sql` — item ending in 59 s: bid extends `end_time` and writes `extended_end_time`;
   item ending in 61 s: no extension; exactly 60 s: assert whichever `place_bid` does (`<` → no
   extension) and pin it.
4. `admin_overrides.sql` — `cancel_last_bid` after a second bid leaves `items` consistent with
   `bid_history`; `extend_deadline` twice = +30; `force_close_item` on `scheduled` raises;
   `cancel_last_bid` on a closed item updates `winner_*`; cancelling an extended bid rolls
   `end_time` back.
5. `lifecycle.sql` — `open_scheduled_auctions` opens past-`start_time` scheduled items, ignores
   `paused`; `close_expired_auctions` ignores `paused`.

### G2 — Vitest
`src/lib/auth/require-admin.test.ts` — mock `getCurrentProfile`; non-admin throws.
`src/lib/auction.test.ts` — `minNextBid`, `isExpired`, `formatUsd` (if E delivered it).
`src/lib/auth/redirect.test.ts` — `safeRedirectPath` cases: `/x`, `//evil`, `https://evil`,
`/\evil`, `undefined`.

### G3 — CI
`.github/workflows/ci.yml` on push + PR: `pnpm install --frozen-lockfile`, `pnpm biome check src`,
`pnpm tsc --noEmit`, `pnpm build` (with dummy `NEXT_PUBLIC_SUPABASE_*` env), `pnpm vitest run`, and
a second job `supabase start && supabase test db` using `supabase/setup-cli`. Cache pnpm.

### G4 — Sentry
Run `pnpm dlx @sentry/wizard@latest -i nextjs --saas` non-interactively if possible; otherwise
add the four files by hand per `DEPLOY.md`. `error.tsx`: replace `console.error` with
`Sentry.captureException`; show a generic message plus `error.digest`, not `error.message`.
Add `global-error.tsx`. Gate everything on `process.env.NEXT_PUBLIC_SENTRY_DSN` so local dev
without a DSN is a no-op.

### G5 — Signup with confirmation enabled
`signUpBidder`: after `signUp`, if `data.session` is null → return `{ ok: true, needsConfirmation:
true }` (extend `AuthActionState`); only `redirect("/")` when a session exists.
`login-form.tsx`: when `signUpState.needsConfirmation`, replace the form with "Check your email —
we sent a confirmation link to {email}". Also handle the `log_audit` unauthenticated case B
left as `TODO(G)`: failed-signup/sign-in audit rows currently need `anon` execute, which B
revoked. Decide: either drop those two audit calls (recommended — Supabase Auth logs failures
itself) or route them through a narrow `log_auth_failure(p_email, p_reason)` function in a new
migration `2026091315MMSS`. Say which.

### G6 — Docs
- `README.md`: rewrite. What it is, stack, `pnpm install` / `.env.local` / `supabase start` /
  `supabase db reset` / `pnpm dev`, link to the three setup docs, test commands, where the
  business logic lives (`place_bid`, migrations), the lifecycle state machine (one diagram).
- `ADMIN_SETUP.md`: remove "planned" language for users/audit pages; fix the `AdminGuard`
  description (redirects, doesn't sign out); delete the `~/.claude/settings.json` bullet; add
  "enable email confirmation" as required, not recommended.
- `DEPLOY.md`: branch is `main`; Sentry section now says "done — set the DSN"; add the pre-event
  checklist: `pg_dump`, verify cron running (`select * from cron.job`), verify webhooks exist,
  send a test email.

## Acceptance criteria

- [x] `pnpm vitest run` green.
- [x] `supabase test db` green locally (or, without Docker, the SQL files are syntactically valid
      and the report says they were not executed).
- [x] CI workflow file lints (`actionlint` if available).
- [x] With `enable_confirmations = true` locally, signup shows the confirmation message and does
      not redirect.
- [x] Throwing in a page renders the generic error UI and (with a DSN) reports to Sentry.
- [x] A new developer can follow `README.md` from clone to a running app without opening another file.

## Out of scope

Component tests for `components/ui/`. Snapshot tests. E2E (Playwright) — P2.

## Additions from `DB_AUDIT.md`

### G1 — extra SQL tests
6. `history_integrity.sql` — deleting an `auth.users` row that has bids raises (FK restrict);
   deleting an item with bids raises; `DELETE` on `bid_history` as admin affects 0 rows;
   `cancel_last_bid` leaves the row with `cancelled_at` set and `items.current_bid` equals the
   max **live** amount.
7. `bid_ordering.sql` — with `dblink` (or two sessions). The **waiting** session must `BEGIN`
   first: B `begin;` → A `begin; place_bid(100); commit;` → B `place_bid(200); commit;`. Assert
   `A.id < B.id` **and** `A.created_at < B.created_at`. (On the pre-H3 schema this second
   assertion fails — that is the regression it guards. If B begins after A, both schemas pass
   and the test is worthless.)
8. `bid_ceiling.sql` — `v_min_bid * 11` rejected, `v_min_bid * 9` accepted.
9. `items_constraints.sql` — `open` with null `end_time` rejected; `scheduled` with a
   `winner_user_id` rejected; `closed` with `winner_user_id <> current_bidder_id` rejected;
   `PATCH items.current_bid` as `authenticated` rejected (after H5).

### G3 — drift gate in CI
Add a job step: `supabase db diff --linked --schema public` must print nothing (or use
`supabase db diff -f /tmp/drift.sql && test ! -s /tmp/drift.sql` against the local shadow DB).
The migrations folder drifted from the dashboard once already; make it fail loudly.

### G6 — README additions
One paragraph on the data-integrity contract: `bid_history` is append-only (cancellation sets
`cancelled_at`), `items.current_*` is a cache maintained only by SQL functions, `order by id` is
the accepted order, and "one database per event" (DB_AUDIT §5 / OQ-1).
