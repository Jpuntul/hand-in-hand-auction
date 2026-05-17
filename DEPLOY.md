# Deploying to Vercel

The free Vercel Hobby plan is enough for a charity auction at this scale.

## Prerequisites

- GitHub repo (push your `rewrite/nextjs-supabase` branch up — or merge it to `main` and push that)
- Vercel account: <https://vercel.com>
- The Supabase env keys you put in `.env.local`

## 1. Push to GitHub

If you haven't already:

```bash
git push -u origin rewrite/nextjs-supabase
```

(Or merge to `main` and push `main`.)

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
| `SUPABASE_SERVICE_ROLE_KEY` | (from your `.env.local`) | Production, Preview |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | (from your `.env.local`) | All |

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

## 5. Smoke test in production

Visit your Vercel URL and walk through the same flows that work locally:

- [ ] Landing page loads
- [ ] Sign up + sign in
- [ ] `/bidding` shows items (after admin creates one)
- [ ] Place a bid — Realtime updates in a second window
- [ ] Auto-close runs (wait for `end_time + 60s`)
- [ ] Outbid email arrives
- [ ] Push notification arrives (if subscribed on a device)

---

# Optional: Sentry (error monitoring)

**Free tier:** 5K errors/month.

1. Sign up at <https://sentry.io>
2. Create a new **Next.js** project; copy the DSN
3. Run the wizard locally:

   ```bash
   pnpm dlx @sentry/wizard@latest -i nextjs
   ```

   It'll add `sentry.client.config.ts`, wrap `next.config.ts` with `withSentryConfig`, and configure source maps.
4. Set `SENTRY_DSN` in `.env.local` AND in Vercel env vars
5. Optionally set `SENTRY_AUTH_TOKEN` for source map upload (wizard handles this)
6. Redeploy

When done, the wizard will also offer to send a test error — verify it shows up in your Sentry dashboard.

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
