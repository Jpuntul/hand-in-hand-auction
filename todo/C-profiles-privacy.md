# C — Profiles privacy (donor PII)

**AUDIT refs:** §2.3 (P0 #3)
**Wave:** 1 · **Complexity:** M · **Migration prefix:** `2026091312MMSS`

## Goal

No authenticated user can read another user's `email`, `phone`, or `is_admin`. Other users'
`display_name` is exposed through a dedicated view.

## Files you own

- `supabase/migrations/2026091312MMSS_profiles_privacy.sql` (new)
- `src/app/history/[id]/page.tsx` — **only** the `bid_history` select string on line ~64 and the
  `BidRow` type. Workstream E also edits this file (client wrapper for the price panel); keep your
  diff to those two spots so the merge is trivial.
- `src/app/admin/(protected)/users/page.tsx` — verify it still works; admins keep full read.

Read-only: `supabase/migrations/20260516223002_rls.sql`, `20260516223001_schema.sql`,
`src/lib/auth/queries.ts`.

## Tasks

### C1 — Migration
```sql
drop policy if exists profiles_select_authenticated on public.profiles;

create policy profiles_select_own on public.profiles for select
  to authenticated using (id = auth.uid());

create policy profiles_select_admin on public.profiles for select
  to authenticated using (public.is_admin());

create or replace view public.public_profiles
  with (security_invoker = false) as
  select id, display_name from public.profiles;

revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;
comment on view public.public_profiles is
  'Display names only. Exists so bid history can show who bid without exposing profiles.email/phone.';
```
`security_invoker = false` (the default) is intentional: the view runs as its owner and bypasses
the new own-row policy — that is the mechanism. Confirm the owner is `postgres`, not a role subject
to RLS.

### C2 — Repoint the embed
`history/[id]/page.tsx`: the select `bidder:profiles!user_id(display_name)` must become an embed on
`public_profiles`. PostgREST can embed a view when it can infer the FK; if inference fails, the
fallback is a second query `from("public_profiles").select("id, display_name").in("id", userIds)`
stitched by id (one extra round-trip, acceptable). Prefer the embed; document which you used.
Update `BidRow.bidder` accordingly. Also change line ~74 `topBidder` **only** if the shape changed.

### C3 — Check every other `profiles` read
`grep -rn 'from("profiles")' src/` — each hit must still work under own-row + admin. Expected: all
are either own-row (`queries.ts`, `signInAdmin`) or admin-only (`users/page.tsx`). Report any that
aren't.

### C4 — `items` / `bid_history` public columns (decision, not code)
`items.current_bidder_id`, `winner_user_id` and `bid_history.user_id` remain publicly readable; with
C1 they now resolve only to display names. That is the intended end state — note it in the migration
comment. Do **not** try to hide bidder UUIDs; the detail page needs them.

## Acceptance criteria

- [x] Bidder JWT: `GET /rest/v1/profiles?select=*` returns exactly one row (own).
- [x] Bidder JWT: `GET /rest/v1/public_profiles?select=*` returns all rows, only `id, display_name`.
- [x] Anon: `GET /rest/v1/public_profiles` works (the detail page is public).
- [x] Admin JWT: `GET /rest/v1/profiles` returns all rows.
- [x] `/history/[id]` still shows bidder display names.
- [x] `/admin/users` unchanged.
- [x] `is_admin()` helper still works (it is `security definer`; unaffected — verify anyway).

## Out of scope

`bid_history` / `items` policies. Anything in `profile-form.tsx`. Type regeneration (integration).

## Additions from `DB_AUDIT.md`

### C2 — while you are in that select (DB-4, DB-2)
- [x] `.order("created_at", { ascending: false })` → `.order("id", { ascending: false })` —
      `created_at` is transaction-start time and is not a reliable accepted order.
- [x] Add `cancelled_at, cancel_reason` to the select. Render cancelled rows struck-through with a
      "Cancelled" badge (they must stay visible — the log is append-only), and compute
      `topBidder` / `uniqueBidders` / the trophy row from **live** rows only
      (`cancelled_at == null`). If H2 has not merged yet, add the fields to the local `BidRow`
      type with the `// TODO(integration)` comment per README rule 3.

### C3 — `profiles.email` is a copy (DB-9)
`profiles.email` is written once by `handle_new_user` and never synced from `auth.users`. Your
own-row policy makes that fine for bidders. Note in the migration comment that the admin users
page shows this copy, and that a sync trigger is listed in `Z-deferred.md` (N1).
