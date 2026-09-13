---
name: pre-event-check
description: Production readiness checklist for the auction night — verifies cron, webhooks, secrets, auth settings, and runs a bid/close smoke test plan. Use in the days before the event or after any remote reset.
---

Work through this list and report a table of ✅ / ❌ / ⚠️ with the evidence for each. Ask the
owner to run remote SQL/CLI steps you cannot run yourself (paused project, no link, etc.).

**Repo / build**
1. `git status` clean on `main`; `/verify` green.
2. `pnpm exec supabase migration list --linked` shows only the baseline versions on both sides.

**Database (SQL editor on the remote)**
3. `select jobname, schedule from cron.job;` → `auction-lifecycle * * * * *`, `audit-log-retention 0 3 * * *`.
4. `select tgname, tgrelid::regclass from pg_trigger where tgname like '%webhook%';` → two rows.
5. `select name from vault.secrets;` includes `webhook_secret`.
6. `select count(*) from public.profiles where is_admin;` ≥ 1.
7. `select id, name, status, start_time, end_time from public.items order by item_no;` — every
   item that should run has `start_time`, `end_time`, and `status in ('scheduled','open')`;
   no `open` item has a null `end_time` (the DB forbids it, but check the plan matches intent).

**Edge Functions / secrets**
8. `pnpm exec supabase secrets list` shows `WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
   `APP_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
9. Both functions deployed (`pnpm exec supabase functions list`).

**Auth / hosting**
10. Email confirmations enabled; Site URL + redirect URLs include the production domain.
11. Vercel has only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
    `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (+ optional `NEXT_PUBLIC_SENTRY_DSN`). No service-role key.

**Smoke test (two accounts, two browsers)**
12. A bids → B outbids → A receives the outbid email/push within a minute.
13. Set one test item's `end_time` 2 minutes ahead → after the cron tick it is `closed`, winner
    set, exactly one set of won/lost emails sent (`items.notified_at` populated).
14. Admin: `cancel_last_bid` on the test item → row soft-cancelled, `current_bid` recomputed.
15. Delete the test item's bids? Not possible by design — cancel the test item instead.

**Operational**
16. `pg_dump` (or dashboard backup) taken; Sentry DSN receiving events; someone knows the
    dashboard → Edge Functions → Logs path for 401 (secret mismatch) diagnostics.
