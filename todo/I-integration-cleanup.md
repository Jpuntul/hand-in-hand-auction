# I — Integration cleanup (lint, type casts, second migration squash)

**Source:** `notes/2026-09-13-changes.md` → "Known/pending"; `DB_AUDIT.md` R8.
**Wave:** post-integration, runs **alone** (touches migrations and many files) · **Complexity:** M
**Prerequisite state:** all of S, A–H, G are in the working tree; `src/lib/supabase/database.types.ts`
has been regenerated from the local DB; `tsc --noEmit`, `pnpm build`, `pnpm vitest run` pass.

## Goal

`pnpm biome check src` is clean, no `TODO(integration)` casts remain, and `supabase/migrations/`
is back to four baseline files that produce **exactly** the same schema as the current 21 files.
No behaviour change anywhere.

## Files you own

- `src/**` — only the files named in I1 and I2 (plus `biome.json` if I1 needs a rule override).
- `supabase/migrations/*` — delete the 17 workstream files, rewrite the 4 baseline files.
- `supabase/config.toml` — only if the squash needs it.
- `README.md` / `DEPLOY.md` — only the lines that name migration files.
- `todo/HANDOFF.md`, `notes/2026-09-13-changes.md` (append an "Integration cleanup (I)" entry).

Do **not** touch tests (`supabase/tests/*.sql`, `src/**/*.test.ts`), Edge Functions, or `.github/`.

## Step-by-step

### I1 — Make `pnpm biome check src` clean (10 errors, 6 warnings, all pre-existing)
1. Run `pnpm biome check src` and list every diagnostic.
2. `src/lib/supabase/client.ts`, `server.ts`, `middleware.ts` — `lint/style/noNonNullAssertion`
   on `process.env.NEXT_PUBLIC_SUPABASE_URL!` / `…ANON_KEY!`: replace the `!` with a small
   `getEnv(name)` helper (new file `src/lib/env.ts`) that throws
   `Error(\`Missing env var ${name}\`)` when undefined. Same behaviour at runtime, no `!`.
3. `middleware.ts` / `server.ts` — `lint/suspicious/useIterableCallbackReturn` on the
   `cookiesToSet.forEach(({ name, value, options }) => …)` lambdas: convert to `for … of` loops
   (or wrap the body in braces so the arrow returns nothing). Behaviour identical.
4. `src/components/ui/label.tsx` — `lint/a11y/noLabelWithoutControl`: this is vendored shadcn.
   Do **not** edit the component; add a `// biome-ignore lint/a11y/noLabelWithoutControl:
   shadcn primitive, htmlFor is passed by callers` comment above the `<LabelPrimitive.Root`.
5. `src/app/globals.css` — `parse` errors on Tailwind v4 syntax (`@theme`, `@custom-variant`,
   `@apply`): configure Biome, don't edit the CSS. In `biome.json` add
   `"css": { "parser": { "tailwindDirectives": true } }` (Biome ≥ 2.x; check
   `pnpm biome --version`). If the installed Biome lacks that option, add
   `"files": { "ignore": ["src/app/globals.css"] }` instead and say so in your report.
6. Any `assist/source/organizeImports` leftovers: `pnpm biome check --write src`.
7. Re-run `pnpm biome check src` → must print `Checked N files … No fixes applied` with 0 errors.

### I2 — Remove `TODO(integration)` casts (types are regenerated)
1. `grep -rn "TODO(integration)" src/` — expected hits: `src/lib/types.ts` (`ItemStatus |
   "paused"`), `src/app/admin/(protected)/items/override-actions.ts` (`ClientWithOverrides`
   local RPC typing), `src/app/admin/(protected)/page.tsx` (`RevenueRow`, `as any`),
   `src/app/admin/(protected)/users/page.tsx` (`user_bid_counts` `as any`),
   `src/app/history/[id]/page.tsx` (`BidRow` with optional `cancelled_at`), and any others.
2. For each: delete the local type / cast and use the generated `Database` types
   (`Database["public"]["Views"]["user_bid_counts"]["Row"]`, `supabase.rpc("cancel_last_bid", …)`
   is now typed, `Database["public"]["Enums"]["item_status"]` already includes `"paused"`).
3. Remove every `// biome-ignore lint/suspicious/noExplicitAny: temporary until
   database.types.ts regeneration` and the `any` it guarded.
4. `grep -rn "TODO(integration)\|as any" src/` → 0 hits (except vendored `components/ui/`).
5. `./node_modules/.bin/tsc --noEmit` → clean.

### I3 — Second migration squash (schema-neutral, proven by diff)
Local Supabase must be running (`pnpm exec supabase start`; Docker required — if unavailable,
STOP and use the preamble `ask` command).
1. **Reference dump from the current 21 files:**
   `pnpm exec supabase db reset` → `pg_dump --schema-only --no-owner --no-privileges=false
   -h 127.0.0.1 -p 54322 -U postgres -n public -n storage -n cron postgres > /tmp/before.sql`
   (keep privileges — `GRANT`/`REVOKE` are part of what changed; also dump
   `select * from cron.job order by jobname` and `select tgname, tgrelid::regclass from
   pg_trigger where not tgisinternal order by 1` to `/tmp/before_extra.txt`).
2. Fold the 17 workstream files into the 4 baseline files **by concern**, final state only:
   - `20260913000000_baseline_schema.sql`: tables incl. `bid_history.cancelled_*`,
     `items.notified_at`, `paused` in the enum, FK `on delete restrict`, all CHECKs
     (`items_*`, `bid_history_cancel_reason_required`, `profiles_*_len`), final indexes
     (`bid_history_item_id_idx (item_id, id desc)`, `bid_history_item_live_idx`, no
     `items_item_no_idx`, no `watchlist_user_id_idx`), `created_at default clock_timestamp()`
     on `bid_history`, views `public_profiles` (owner postgres, `security_invoker=false`),
     `user_bid_counts`, `open_items_revenue`, comments.
   - `20260913000100_baseline_functions.sql`: final `place_bid` (v2), `log_audit` (locked
     down), `is_admin`, triggers, `close_expired_auctions`, `open_scheduled_auctions`, the five
     override RPCs, `install_notification_webhooks`, then **all grants/revokes** exactly as in
     `20260913110300_function_privileges.sql` + `alter default privileges`.
   - `20260913000200_baseline_rls.sql`: final policies only (`profiles_select_own/admin`, no
     `profiles_select_authenticated`, no `bid_history_delete_admin`, no
     `notification_prefs_select_admin`), column privileges on `profiles` and `items`
     (revoke table UPDATE, grant per column) from `20260913100000` and `20260913170000`.
   - `20260913000300_baseline_ops.sql`: realtime publication (`items` only), storage bucket +
     policies, cron jobs `auction-lifecycle` and `audit-log-retention` (not
     `close-expired-auctions`), `pg_net`, `select public.install_notification_webhooks()`.
   Keep the "why" comments from the workstream files (they are the design record).
3. Delete the 17 `202609130[9-9]…`/`2026091310…`–`2026091317…` files.
4. `pnpm exec supabase db reset` on the 4 files → same dumps to `/tmp/after.sql`,
   `/tmp/after_extra.txt`.
5. `diff <(sort /tmp/before.sql) <(sort /tmp/after.sql)` and `diff /tmp/before_extra.txt
   /tmp/after_extra.txt` → **both empty** (ignore `schema_migrations` rows and comment-only
   lines). If not empty, fix the baseline until it is. Paste the commands and the empty result
   in your report.
6. `pnpm exec supabase test db` → all 44 pgTAP assertions still pass (they run against the
   baseline now).
7. Update any doc line that names a workstream migration file (`grep -rn "2026091[3-9]1" *.md
   NOTIFICATIONS_SETUP.md DEPLOY.md README.md`).

### I4 — Final verification
- [ ] `pnpm biome check src` — 0 errors, 0 warnings.
- [ ] `./node_modules/.bin/tsc --noEmit` — clean.
- [ ] `pnpm vitest run` — 17 passed.
- [ ] `pnpm build` — succeeds.
- [ ] `pnpm exec supabase test db` — 44 passed.
- [ ] `ls supabase/migrations` → exactly 4 files.
- [ ] `grep -rn "TODO(integration)" src/` → nothing.
- [ ] Append to `notes/2026-09-13-changes.md` under a new `## Integration cleanup (I)` heading:
      what was squashed, the diff proof, the biome config change, and that no behaviour changed.

## Out of scope

Committing (the owner commits). Any new feature. Fixing anything the tests reveal beyond what
the squash itself broke — report it instead.
