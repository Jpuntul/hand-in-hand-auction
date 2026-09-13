---
name: db-change
description: Procedure for any schema, function, RLS, or privilege change in supabase/. Use when asked to add a column, table, RPC, policy, index, cron job, or to change place_bid / override functions.
---

Read `docs/database.md` and `.claude/rules/database.md` first. Then:

1. **Design in one paragraph before writing SQL**: which invariant changes, who may call/write it
   (anon / bidder / admin / function-only), and which pgTAP test proves it. If it touches
   `items.current_*`, `bid_count`, `winner_*` or `bid_history`, it must be a `SECURITY DEFINER`
   function with `for update` on the `items` row — say so.
2. **Migration**: new file `supabase/migrations/$(date -u +%Y%m%d%H%M%S)_<concern>.sql`. One
   concern. Idempotent. Explicit `grant execute` for new functions; explicit column
   `grant update` for new bidder-editable columns. Keep the "why" as a header comment.
3. **Apply locally**: `pnpm exec supabase db reset` (requires Docker; if unavailable, stop and say
   so — do not claim verification).
4. **Test**: add or extend a file in `supabase/tests/` (pgTAP). Every CHECK constraint, RLS rule
   and privilege gets a positive and a negative assertion. `pnpm exec supabase test db`.
5. **Types**: `pnpm exec supabase gen types typescript --local > src/lib/supabase/database.types.ts`
   (strip any pnpm banner lines at the top if present), then `pnpm tsc --noEmit`.
6. **App**: update callers; never add `as any` to bridge a type gap.
7. **Docs**: update `docs/database.md` (ERD/tables/invariants/RPC table/access matrix as
   applicable) and append a `notes/` entry naming the migration file.
8. Run `/verify`. Do not run `db reset --linked` or `db push`; the owner applies to the remote.
