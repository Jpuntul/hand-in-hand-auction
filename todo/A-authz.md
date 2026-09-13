# A — Authorization & input validation

**AUDIT refs:** §2.1 (P0 #1), §2.7 (P1 #7), §2.15 (P1 #15)
**Wave:** 1 · **Complexity:** S · **Migration prefix:** `2026091310MMSS`

## Goal

Every admin server action must (a) refuse non-admin callers explicitly, (b) treat "zero rows
affected" as failure, and (c) write its audit entry only after a confirmed mutation. Close the open
redirect. Validate profile updates server-side and stop bidders rewriting their own `email`.

## Files you own

- `src/lib/auth/require-admin.ts` (new)
- `src/lib/auth/redirect.ts` (new)
- `src/lib/auth/actions.ts`
- `src/app/admin/login/page.tsx`
- `src/app/admin/(protected)/users/actions.ts`
- `src/app/admin/(protected)/items/actions.ts`
- `src/app/admin/(protected)/items/override-actions.ts` — **only** to add `requireAdmin()` calls
  and row-count checks. Workstream B will rewrite the bodies afterwards; keep your diff minimal
  (guard at top, `.select()` + empty check, audit after). Do not restructure.
- `src/app/account/profile/actions.ts`
- `supabase/migrations/2026091310MMSS_profiles_column_privileges.sql` (new)

Read-only context: `src/lib/auth/queries.ts`, `supabase/migrations/20260516223002_rls.sql`,
`supabase/migrations/20260516223003_triggers.sql`.

## Tasks

### A1 — `requireAdmin()` helper
`src/lib/auth/require-admin.ts`, `import "server-only"`. Uses `getCurrentProfile()`; throws
`Error("Forbidden")` when `!profile?.is_admin`; returns the profile. Call it as the **first
statement** of every exported function in the three admin `actions.ts` files and
`override-actions.ts`. Server actions that currently return `{ ok:false, error }` should catch the
throw and return `{ ok: false, error: "Forbidden" }` — match the existing result shape, don't leak
stack traces.

### A2 — Zero rows = failure
Every `.update(...)` / `.delete(...)` in your owned action files: append `.select("id")` and treat
an empty result as `{ ok: false, error: "Not found or not permitted" }`. Move every `log_audit`
RPC call **after** that check. Add audit calls to `createItem` / `updateItem` / `deleteItem`
(`admin.item.create` / `.update` / `.delete`, target_type `"item"`, include `item_name`).

### A3 — Safe redirect
`src/lib/auth/redirect.ts`: `export function safeRedirectPath(p: unknown, fallback = "/admin")`
returning `p` only if it is a string, starts with `/`, and does not start with `//` or `/\`.
Use it in `src/app/admin/login/page.tsx:18` and `src/lib/auth/actions.ts` (`signInAdmin`, both the
`redirectTo` read and the final `redirect()`).

### A4 — Profile validation
`src/app/account/profile/actions.ts`: validate with Zod before writing. Reuse the constraints from
`signUpSchema` in `lib/auth/actions.ts` (`display_name` 1–100 chars trimmed, `phone` ≤ 50 optional).
Export a shared `profileFieldsSchema` from `lib/auth/actions.ts` (or a new `lib/auth/schemas.ts`
that you also own) so signup and update use one definition. Return the first Zod issue message on
failure, same as signup does.

### A5 — Column privileges migration
```sql
-- NOT is_admin: admins update it through profiles_update_admin and a column-level revoke on
-- `authenticated` would block them. The prevent_self_promotion trigger already guards it.
revoke update (id, email, created_at, updated_at) on public.profiles from authenticated;

alter table public.profiles
  add constraint profiles_display_name_len check (display_name is null or length(display_name) <= 100),
  add constraint profiles_phone_len check (phone is null or length(phone) <= 50);
```
Wrap the constraint adds in a `do $$ ... if not exists ... $$` block so the migration is idempotent.
Confirm `handle_new_user` (trigger, `security definer`) still inserts `email` — it runs as owner, so
the revoke does not affect it; verify anyway.

## Acceptance criteria

- [x] A non-admin calling any admin action gets `{ ok: false, error: "Forbidden" }` and **no**
      `audit_log` row is written.
- [x] An admin action whose RLS-filtered mutation matches zero rows returns `ok: false`, not `ok: true`.
- [x] `createItem` / `updateItem` / `deleteItem` write audit rows.
- [x] `/admin/login?redirect=https://evil.tld` and `?redirect=//evil.tld` both land on `/admin`.
- [x] `updateProfile` rejects a 101-char display name server-side.
- [x] `PATCH /rest/v1/profiles` on own row setting `email` is rejected by Postgres.
- [x] Signup and profile-update share one schema definition.

## Out of scope

Rewriting override action bodies (B). Realtime / UI (E). RLS `SELECT` on `profiles` (C).
