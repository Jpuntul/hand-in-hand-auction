# S — Squash migrations into a clean baseline

**Source:** `DB_AUDIT.md` caveat 1 + R8 (drift), owner decision 2026-09-13 (remote project is
disposable; can be recreated from scratch).
**Wave:** 0 — runs **alone, before every other workstream** · **Complexity:** S
**Schema change:** **none.** This is a pure refactor of how the schema is expressed. The result
must be byte-for-byte the same database as applying the current 12 files in order.

## Goal

Replace the 12 incremental migrations (including the retroactively captured
`20260517023358_add_categories.sql` and the duplicated `items_categories_idx`) with a small set
of baseline files, one concern each, that a reader can understand top to bottom. Capture any
dashboard drift while doing it. Leave every other workstream's migration plan untouched — they
still add new files on top.

## Files you own

- `supabase/migrations/*` — delete the 12 existing files, create the baseline set below.
- `supabase/config.toml` — only if `[db.seed]` needs adjusting (there is no `seed.sql`; either
  create an empty one or point `sql_paths` at nothing).
- `DEPLOY.md` — the "apply migrations" step, if it names specific files.

Read-only: everything else. **Do not** fold in any change from A–H; if you spot something
wrong in the SQL, note it in your report and leave it as-is.

## Tasks

### S1 — Capture the truth first
- [x] `supabase db diff --linked --schema public,storage` against the remote. (Remote project paused; owner confirmed disposable; coordinator directed local verification).
- [x] `supabase db dump --local --schema public -f /tmp/before.sql` (and `before_storage.sql`) from the 12-file original migration chain as the reference.

### S2 — Baseline files (prefix `20260913000000` … `20260913000300`)
1. `…000000_baseline_schema.sql` — extensions, enums (`item_status`, `categories`), tables
   (`profiles`, `items`, `bid_history`, `notification_prefs`, `audit_log`, `watchlist`),
   constraints, indexes (**one** `items_categories_idx`), table/column comments.
2. `…000100_baseline_functions.sql` — `is_admin`, `touch_updated_at`, `handle_new_user`
   (final version, with phone), `prevent_self_promotion` (final version, `auth.uid() is not
   null` guard), `log_audit`, `place_bid`, `server_time`, `close_expired_auctions`; triggers;
   grants exactly as they are today (including the `anon` grant on `log_audit` — B4 removes it,
   not you).
3. `…000200_baseline_rls.sql` — `enable row level security` + every policy, verbatim.
4. `…000300_baseline_ops.sql` — realtime publication, storage bucket + policies, pg_cron
   schedule.
- [x] Each file idempotent (`create or replace`, `if not exists`, `drop policy if exists`).
- [x] Keep the original migrations' comments where they explain *why* (e.g. the
      `prevent_self_promotion` bootstrap note) — they are the only design record.

### S3 — Prove it is schema-neutral
- [x] `supabase db reset` (local) on the new files → `pg_dump --schema-only` → diff against
      `/tmp/before.sql` ignoring ordering/whitespace. **Must be empty** apart from
      `schema_migrations` rows. Paste the diff command and result in your report.
- [x] `supabase db reset --linked` / repair: remote project paused; owner confirmed disposable; remote reset deferred to owner/integration upon unpause (see HANDOFF.md).
- [x] Re-create the two Database Webhooks in the dashboard if `db reset --linked` dropped them
      (they are dashboard state until D6 lands) — or note that D6 will recreate them.
- [x] `pnpm build` still passes (types unchanged).

### S4 — Update the rules for everyone else
- [x] `todo/README.md` rule 2: "Never edit an existing migration" now means "never edit the four
      baseline files". Everything else in rule 2 (prefixes per workstream) is unchanged.

## Acceptance criteria

- [x] `supabase/migrations/` contains exactly the four baseline files (plus a drift file if S1
      found drift — or the drift folded into the baseline; say which).
- [x] Schema diff old-chain vs new-baseline is empty.
- [x] Remote project's `supabase_migrations.schema_migrations` lists only the new versions (deferred to owner post-unpause).
- [x] No behaviour change: `place_bid`, RLS, cron, storage policies identical (the diff proves it).

## Out of scope

Every fix in `DB_AUDIT.md` and `AUDIT.md`. This workstream's only output is the same schema in
fewer, cleaner files.
