#!/usr/bin/env node
// Generate a fresh pair of VAPID keys for Web Push.
//
// Usage: pnpm gen:vapid
//
// The output prints both keys so you can paste them into the right places.
// VAPID_PRIVATE_KEY is sensitive — do NOT commit it.

import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("\nGenerated VAPID keys.\n");

console.log("─ Add to .env.local ──────────────────────────────────");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log("");

console.log("─ Set as Supabase Edge Function secrets ─────────────");
console.log(`pnpm exec supabase secrets set VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`pnpm exec supabase secrets set VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("");

console.log("Then redeploy the Edge Functions so they pick up the new secrets:");
console.log("  pnpm exec supabase functions deploy on-bid-placed");
console.log("  pnpm exec supabase functions deploy on-auction-closed\n");
