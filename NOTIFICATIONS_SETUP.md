# Notifications setup

Email notifications are sent by two Supabase Edge Functions:

- `on-bid-placed` — fires on `bid_history` INSERT, emails the user who was outbid
- `on-auction-closed` — fires on `items` UPDATE, emails winner + losers when status transitions to `closed`

Both are triggered by **Supabase Database Webhooks** (configured once in the dashboard) and call Resend to deliver the email.

## One-time setup

### 1. Add Edge Function secrets

The Edge Functions read these from Supabase's Edge Function secrets, not from `.env.local`. Set them once with the CLI:

```bash
pnpm exec supabase secrets set RESEND_API_KEY=re_xxx
pnpm exec supabase secrets set EMAIL_FROM='Hand in Hand <onboarding@resend.dev>'
pnpm exec supabase secrets set APP_URL=http://localhost:3000
```

Update `APP_URL` to your Vercel URL once you deploy (Phase 5).

### 2. Deploy the Edge Functions

```bash
pnpm exec supabase functions deploy on-bid-placed
pnpm exec supabase functions deploy on-auction-closed
```

You should see them at:
<https://supabase.com/dashboard/project/raxaicqhlbmyzngcubye/functions>

### 3. Configure database webhooks

Go to <https://supabase.com/dashboard/project/raxaicqhlbmyzngcubye/database/hooks> and click **Create a new hook**.

**Webhook 1 — outbid notification**

| Setting | Value |
|---|---|
| Name | `bid-placed-notification` |
| Table | `bid_history` |
| Events | ✅ Insert |
| Type | Supabase Edge Functions |
| Edge Function | `on-bid-placed` |
| HTTP method | POST (default) |
| HTTP headers | leave defaults |

**Webhook 2 — auction closed notification**

| Setting | Value |
|---|---|
| Name | `auction-closed-notification` |
| Table | `items` |
| Events | ✅ Update |
| Type | Supabase Edge Functions |
| Edge Function | `on-auction-closed` |
| HTTP method | POST (default) |

The Edge Function itself filters out non-closing updates, so the webhook fires on every items UPDATE but only sends emails on the open→closed transition.

## Verifying it works

1. Sign up two test accounts in different browsers (A and B)
2. Make sure both have a verified email (or disable email confirmation in Supabase Auth)
3. A bids on an item, then B outbids A
4. A receives an **Outbid** email within seconds
5. Wait for `end_time + 1 min` (pg_cron auto-closes)
6. Winner gets a **You won** email, other bidders get **Auction closed**

## Where to see logs

- Edge Function logs: <https://supabase.com/dashboard/project/raxaicqhlbmyzngcubye/functions/on-bid-placed/logs>
- Resend delivery log: <https://resend.com/emails>

## Using your own sender domain

Until you verify a domain in Resend, emails come from `onboarding@resend.dev`. Many corporate mail providers reject that sender. For production:

1. Resend dashboard → **Domains** → add `handinhandmyanmar.org` (or whatever you own)
2. Add the DNS records they provide (SPF, DKIM)
3. Update the secret: `pnpm exec supabase secrets set EMAIL_FROM='Hand in Hand <auctions@handinhandmyanmar.org>'`

## Bidder preferences

Bidders can opt out of email at **/account/notifications** (linked from the user menu). Opt-outs are stored in `public.notification_prefs.email_optin` and respected by both Edge Functions.

## What's not yet implemented

- **Web Push** — instant browser notifications even with tab closed. Planned for Phase 4 part 2.
- **Reminder emails** — "24 hours before close" and "1 hour before close" via pg_cron. Planned for Phase 4 part 2.
