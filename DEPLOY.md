# Deploying to Vercel

The free Vercel Hobby plan is enough for a charity auction at this scale.

## Prerequisites

- GitHub repo (branch `main`)
- Vercel account: <https://vercel.com>
- The Supabase env keys you put in `.env.local`

## 1. Push to GitHub

Ensure your latest changes are pushed to `main`:

```bash
git push -u origin main
```

## 2. Import into Vercel

1. Go to <https://vercel.com/new>
2. **Import Git Repository** → select your repo
3. Framework preset: **Next.js** (auto-detected)
4. **Root Directory**: leave as `./`
5. **Build & Output Settings**: defaults are correct (Vercel runs `pnpm build`)

Before clicking Deploy, add environment variables (next step).

## 3. Environment variables (Vercel project settings)

Paste these into Vercel's **Environment Variables** UI before the first deploy. Mark each one for **Production**, **Preview**, **Development** as appropriate.

| Key | Value | Scopes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://raxaicqhlbmyzngcubye.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (from your `.env.local`) | All |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | (from your `.env.local`) | All |
| `NEXT_PUBLIC_SENTRY_DSN` | (from your Sentry project) | All |

> **Note:** Never add the service role key to Vercel — nothing in the Next.js app uses it. If it was ever added, rotate it.

After the first deploy you'll have a URL like `https://hand-in-hand-auction.vercel.app`. Come back here and update the Supabase Edge Function secret:

```bash
pnpm exec supabase secrets set APP_URL=https://hand-in-hand-auction.vercel.app
pnpm exec supabase functions deploy on-bid-placed
pnpm exec supabase functions deploy on-auction-closed
```

Without this, the "Place a higher bid" link in outbid emails will point to localhost.

## 4. Custom domain (optional)

1. In Vercel **Settings → Domains**, add your domain (e.g. `auction.handinhandmyanmar.org`)
2. Add the CNAME/A record Vercel shows you with your DNS provider
3. Re-run the `APP_URL` update from step 3 with the custom domain

## 5. Pre-event checklist

Before opening the auction to bidders, run through this operational checklist:

1. **Database backup**: Run a baseline export before the event starts:
   ```bash
   pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -Fc -f pre_event_backup.dump
   ```
2. **Verify cron jobs are active**: Ensure the lifecycle opener and closer jobs are scheduled and healthy:
   ```sql
   select * from cron.job;
   select * from cron.job_run_details order by start_time desc limit 10;
   ```
3. **Verify webhooks exist**: Confirm the database triggers for `on-bid-placed` and `on-auction-closed` are registered in Supabase:
   ```sql
   select tgname, relname from pg_trigger t join pg_class c on t.tgrelid = c.oid where tgname in ('tr_bid_placed', 'tr_auction_closed');
   ```
4. **Send a test email**: Trigger an outbid email or close notification in staging/production to verify SMTP / Resend delivery.
5. **Verify Sentry**: Confirm that errors reporting to `NEXT_PUBLIC_SENTRY_DSN` land in your Sentry dashboard.

---

# Error Monitoring: Sentry

**Status:** Done — configured in code.

Sentry error monitoring is wired into `next.config.ts`, `instrumentation.ts`, `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/app/error.tsx`, and `src/app/global-error.tsx`.

To enable error reporting in production:
1. Create a project at <https://sentry.io> and copy your project DSN.
2. Add `NEXT_PUBLIC_SENTRY_DSN` to your Vercel Environment Variables (and `.env.local` for staging testing).
3. If no DSN is provided, error logging safely falls back to standard console logging without throwing.

---

# Optional: PostHog (product analytics)

**Free tier:** 1M events/month + 5K session recordings.

1. Sign up at <https://posthog.com>
2. Create a project, copy the **Project API key** (starts with `phc_...`)
3. Install:
   ```bash
   pnpm add posthog-js
   ```
4. Add to `src/components/providers.tsx`:
   ```tsx
   "use client";
   import posthog from "posthog-js";
   import { PostHogProvider } from "posthog-js/react";
   import { useEffect } from "react";

   if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
     posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
       api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
       capture_pageview: "history_change",
     });
   }

   export function Providers({ children }) {
     return <PostHogProvider client={posthog}>{/* existing QueryClientProvider here */}{children}</PostHogProvider>;
   }
   ```
5. Add env vars to `.env.local` AND Vercel:
   ```
   NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
   ```
6. Track custom events in code with `posthog.capture("bid_placed", { item_id, amount })` as needed.

---

# Budget alert (recommended)

Once everything's live, set a $1/month budget alert on your Supabase project:
<https://supabase.com/dashboard/project/raxaicqhlbmyzngcubye/settings/billing>

You'll stay well within the free tier for a charity auction, but the alert tells you immediately if anything spikes.
