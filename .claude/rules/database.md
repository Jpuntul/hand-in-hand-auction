---
paths:
  - "supabase/**"
  - "src/lib/supabase/**"
---

# Database rules (supabase/**)

- **Never edit** `supabase/migrations/20260913000{000,100,200,300}_baseline_*.sql`. Add a new file
  `YYYYMMDDHHMMSS_<concern>.sql`, one concern per file, idempotent (`create or replace`,
  `if not exists`, `drop policy if exists`, `do $$ … $$` guards for constraints).
- Enum values need their own migration file (they cannot be used in the transaction that adds them).
- Every function: `security definer`, `set search_path = public`, then an explicit
  `grant execute on function … to <role>` — default privileges revoke `EXECUTE` from `public`/`anon`.
  Admin-only RPCs check `public.is_admin()` as their first statement and raise `42501` otherwise.
- Anything that changes `items.current_*`, `bid_count`, `winner_*` or `bid_history` goes through a
  function that does `select … from items where id = … for update` first. Lock `items` before
  touching `bid_history` (that is the lock order every existing function uses — keep it, or you
  will deadlock with `place_bid`).
- New columns on `profiles` or `items` are **not** writable by `authenticated` until you
  `grant update (col) on <table> to authenticated` — decide deliberately.
- `now()` is transaction start; use `clock_timestamp()` after acquiring a lock when the exact
  moment matters. Bid order is `id`.
- RLS: policies are per role (`anon`, `authenticated`) and per verb; `using` for read/delete,
  `with check` for insert/update. Cross-user reads of `profiles` go through `public_profiles` only.
- After a schema change, in this order: `pnpm exec supabase db reset` → write/adjust a pgTAP test
  in `supabase/tests/` → `pnpm exec supabase test db` → regenerate `database.types.ts` →
  `pnpm tsc --noEmit` → update `docs/database.md` → add a `notes/` entry.
- Local only: `db reset` without `--linked`. Remote resets/pushes are the owner's decision.
