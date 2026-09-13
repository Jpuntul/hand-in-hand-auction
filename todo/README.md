# Remediation workstreams

Source of truth for *why*: `../AUDIT.md` (engineering audit) and `../DB_AUDIT.md` (database
schema audit — same commit). Each file here is a self-contained brief for one sub-agent. Section
numbers (§2.x) and P-numbers refer to `AUDIT.md`; `DB-n` / `R-n` / `OQ-n` refer to `DB_AUDIT.md`.

## Workstreams

| ID | File | Scope | AUDIT items | Cx |
|---|---|---|---|---|
| **A** | `A-authz.md` | `requireAdmin()`, zero-rows = failure, open redirect, profile validation, profile column revoke | P0 #1, P1 #7, #15 | S |
| **B** | `B-lifecycle-sql.md` | `paused` status, auto-open cron, atomic `cancel_last_bid` / `force_close` / `extend` SQL fns, delete guard, `log_audit` lockdown, constraints | P0 #4, #5, P1 #8, #9 (SQL half), #13 | M |
| **C** | `C-profiles-privacy.md` | Own-row `profiles` RLS + `public_profiles` view | P0 #3 | M |
| **D** | `D-edge-functions.md` | Webhook secret, idempotency, batched fan-out, webhooks-as-migration, remove service-role key from Vercel docs | P0 #2, #6, P1 #11, #17 | M |
| **E** | `E-frontend-realtime.md` | Grid tick, "Ends in ended", `ItemsGrid` contracts + reconnect, detail-page realtime, dialog reset, error mapping | P1 #10, #12, #14 | M |
| **F** | `F-admin-pages.md` | Users page `user_bid_counts` view, item form (lifecycle columns, dirty-fields, seconds, `zodResolver`, refines) | P1 #9 (form half), #16, §2.18 | S |
| **G** | `G-tests-ci-ops.md` | Sentry, CI workflow, nine tests, drift gate, signup-confirmation state, docs refresh | P1 #18, #19, #20; DB_AUDIT G1/G3 | M |
| **S** | `S-squash-migrations.md` | Squash the 12 migrations into 4 baseline files; capture drift; **no schema change** (diff must be empty) | DB_AUDIT caveat 1, R8 | S |
| **H** | `H-db-integrity.md` | `bid_history` FK restrict + soft-cancel + `order by id`; `place_bid` v2 (clock, ceiling); column privileges on derived `items` columns; policy/index cleanup | DB_AUDIT DB-1..5, DB-17, DB-18, DB-20 | M |
| **I** | `I-integration-cleanup.md` | Post-integration: biome clean, remove TODO(integration) casts, second migration squash (schema-neutral) | notes/ Known-pending | M |
| — | `Z-deferred.md` | P2 / P3 backlog — **not** for this pass | — | — |

## Execution order

```
Wave 0 (alone):     S — squash + drift capture; nobody else touches supabase/migrations until S is merged
Wave 1 (parallel):  A   C   D   E   H1–H4, H6 (bid_history FKs, soft-cancel, ordering, place_bid v2)
Wave 2:             B   (imports requireAdmin from A; owns override-actions.ts after A;
                         B2 is written against H2/H3's soft-cancel + order-by-id contract)
Wave 2 (parallel):  F   (after B — form must match B's new status enum; F1 view filters cancelled)
Wave 3:             H5  (column privileges — ONLY after B7 has removed direct writes)
Wave 3:             G   (after A, B, H — the SQL tests are their regression tests)
Integration:        regenerate database.types.ts, full build, smoke test
Wave 4 (alone):     I — lint clean, drop TODO(integration) casts, squash 21 migrations → 4 (diff must be empty)
```

A, C, D, E, and H1–H4/H6 touch disjoint files and can start together. B must wait for A because
both edit `override-actions.ts`, and B2 must follow H2/H3's design (soft-cancel, `order by id`) —
read the "Design changes from DB_AUDIT.md" section at the bottom of `B-lifecycle-sql.md`. H5 must
wait for B7 or the old override actions break at runtime.

## Hard rules for every agent

1. **Stay inside your "Files you own" list.** If you need a change in a file another workstream
   owns, write the request into `todo/HANDOFF.md` (create it if missing) under your ID and stop —
   do not edit the file.
2. **Migrations:** create new files under `supabase/migrations/`. Never edit an existing migration
   (never edit the four `20260913000x00_baseline_*.sql` files).
   Use your assigned hour in the timestamp so ordering across workstreams is deterministic
   (format `YYYYMMDDHHMMSS_name.sql`; increment the minutes for multiple files):
   - A: `2026091310MMSS_*`   B: `2026091311MMSS_*`   C: `2026091312MMSS_*`
   - D: `2026091313MMSS_*`   F: `2026091314MMSS_*`   G: `2026091315MMSS_*`
   - H1–H4, H6: `2026091309MMSS_*` — **before A**, because B2's functions and F1's view reference
     the `bid_history.cancelled_at` column H2 creates and must sort after it at `db reset`.
   - H5 only: `2026091317MMSS_*` — after everything (it must follow B7).
   e.g. `20260913100000_profiles_column_privileges.sql`, `20260913110000_item_status_paused.sql`,
   `20260913110100_lifecycle_open_and_pause.sql`.
   Every migration must be idempotent (`create or replace`, `if not exists`, `drop policy if exists`).
3. **Do not regenerate `src/lib/supabase/database.types.ts`.** Integration does that once. If your
   change needs a type that doesn't exist yet, add a narrow local type in the file that uses it
   with a `// TODO(integration): replace with generated type` comment.
4. **No new dependencies** unless the brief says so.
5. **No commits.** Leave changes in the working tree. Integration commits per workstream.
6. **Environment:** `node_modules` may be absent — run `pnpm install` first. Local Supabase
   (`supabase start`) needs Docker; if unavailable, verify SQL by careful reading and note it in
   your final report. `pnpm biome check src`, `pnpm tsc --noEmit` and `pnpm build` must pass before
   you report done.
7. **Match the surrounding code.** Same comment density, same `{ ok, error }` result shape, same
   naming. Do not add abstractions the brief didn't ask for.
8. **Final report** (returned as your result, ≤ 40 lines): files changed, migrations added, what
   you verified and how, anything deferred to `HANDOFF.md`, anything you found that the audit missed.

## Definition of done (all workstreams)

- Every acceptance criterion in your brief is met.
- `pnpm biome check src` — clean.
- `pnpm tsc --noEmit` — clean (modulo `database.types.ts` gaps noted per rule 3).
- `pnpm build` — succeeds.
- No file outside your ownership list is modified (`git status` shows only yours).
