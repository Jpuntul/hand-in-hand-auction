# Admin setup

## Bootstrapping the first admin

There is no public sign-up flow for admins. The first admin must be promoted manually via Supabase SQL.

1. Visit [`/login`](http://localhost:3000/login) and sign up with the email + password you want for the admin account.
2. Open the Supabase SQL editor:
   <https://supabase.com/dashboard/project/raxaicqhlbmyzngcubye/sql/new>
3. Run:

   ```sql
   update public.profiles
   set is_admin = true
   where email = 'admin@example.com';
   ```

4. Sign out (any session loses the change until next sign-in), then visit `/admin/login` and sign back in. You should land on `/admin`.

## Inviting additional admins

Once you have one admin, the planned **Admin Users** page (Phase 6.5) will let you promote any existing user via the UI. Until that ships, repeat the SQL step above for each new admin.

## Recommended Supabase dashboard settings

Configure these once for production at <https://supabase.com/dashboard/project/raxaicqhlbmyzngcubye/auth>:

- **Email confirmation** — enable for production. Without it, anyone can sign in with an unverified email.
- **Site URL** — set to your deployment URL (e.g. `https://hand-in-hand.vercel.app`) so confirmation links work.
- **Rate limits** — Supabase blocks failed sign-ins after ~30 attempts/hour per IP by default. Tighten in the dashboard if needed.

## Auditing sign-in attempts

Every sign-in event (success and failure) is recorded in `public.audit_log` via the `log_audit()` RPC. View recent admin attempts with:

```sql
select created_at, action, actor_email, metadata
from public.audit_log
where action like 'auth.admin.%'
order by created_at desc
limit 50;
```

A full audit-log viewer lands in Phase 6.3.

## Security guarantees

- **No self-promotion.** The `prevent_self_promotion` trigger blocks non-admin users from setting their own `is_admin = true`.
- **Defense in depth on `/admin/*`.** Next.js middleware redirects unauthenticated requests to `/admin/login`; the `AdminGuard` server component additionally checks `profiles.is_admin` and signs out users who lack the role.
- **Admin sign-in is hardened.** If you sign in via `/admin/login` and are not an admin, the session is immediately terminated and an `auth.admin.signin.denied` event is logged.
- **`.env.local` is never committed.** The deny rules in `~/.claude/settings.json` also prevent assistant tools from reading it.
