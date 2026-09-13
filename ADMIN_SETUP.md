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

4. Sign out, then visit `/admin/login` and sign back in. You should land on `/admin`.

## Managing additional admins

Once you have bootstrapped the first admin, use the **Admin Users** page at [`/admin/users`](http://localhost:3000/admin/users) to toggle admin privileges for any existing registered user directly from the UI. You can also promote users via the SQL query above.

## Required Supabase dashboard settings

Configure these for production at <https://supabase.com/dashboard/project/raxaicqhlbmyzngcubye/auth>:

- **Email confirmation** — **required** for production. Without it, anyone can sign in with an unverified email.
- **Site URL** — set to your deployment URL (e.g. `https://hand-in-hand-auction.vercel.app`) so confirmation links work.
- **Rate limits** — Supabase blocks failed sign-ins after ~30 attempts/hour per IP by default. Tighten in the dashboard if needed.

## Auditing admin actions and sign-ins

All admin actions and authentication events are recorded in `public.audit_log` via the `log_audit()` RPC.

- View and search the audit trail directly in the UI at [`/admin/audit-log`](http://localhost:3000/admin/audit-log).
- Or query recent attempts directly via SQL:

```sql
select created_at, action, actor_email, metadata
from public.audit_log
where action like 'auth.admin.%' or action like 'admin.%'
order by created_at desc
limit 50;
```

## Security guarantees & data integrity

- **No self-promotion.** The `prevent_self_promotion` trigger blocks non-admin users from setting their own `is_admin = true`.
- **Defense in depth on `/admin/*`.** Next.js middleware checks the session and redirects unauthenticated users to `/admin/login`; `AdminGuard` additionally verifies `profiles.is_admin` and redirects unauthorized users to `/admin/login?redirect=...` without signing them out.
- **Admin sign-in is hardened.** If a non-admin signs in via `/admin/login`, the session is terminated and an `auth.admin.signin.denied` event is logged.
- **Deletion restrictions.** Users with bids cannot be deleted; items with bids cannot be deleted — cancel instead. All bid and item foreign keys enforce `ON DELETE RESTRICT` to protect auditability and financial integrity.
