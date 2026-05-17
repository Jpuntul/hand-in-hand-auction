// Webhook fired by Supabase Database Webhooks on every UPDATE of
// public.items. Sends "you won" / "you lost" emails AND push notifications
// when status transitions to 'closed'. Ignores every other update silently.
//
// Payload format (Supabase Database Webhook):
//   { type: "UPDATE", table: "items", schema: "public",
//     record: <new row>, old_record: <old row> }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { lostEmail, sendEmail, wonEmail } from "../_shared/email.ts";
import {
  type PushSubscriptionRecord,
  pruneExpiredSubscriptions,
  sendPush,
} from "../_shared/push.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:3000";
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

type EmailOutcome = {
  user_id: string;
  outcome: "won" | "lost";
  email_sent: boolean;
  push_sent: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const payload = await req.json().catch(() => null);
  if (!payload || payload.type !== "UPDATE" || payload.table !== "items") {
    return new Response("Ignored", { status: 200, headers: corsHeaders });
  }

  const oldItem = payload.old_record as { status: string };
  const newItem = payload.record as {
    id: string;
    name: string;
    item_no: number | null;
    status: string;
    winner_user_id: string | null;
    winning_bid: number | null;
  };

  if (oldItem.status === "closed" || newItem.status !== "closed") {
    return new Response("Not a closing transition", {
      status: 200,
      headers: corsHeaders,
    });
  }

  const results: EmailOutcome[] = [];

  // Winner
  if (newItem.winner_user_id && newItem.winning_bid != null) {
    const r = await notify({
      userId: newItem.winner_user_id,
      emailTemplate: wonEmail({
        itemName: newItem.name,
        itemNo: newItem.item_no,
        winningBid: newItem.winning_bid,
      }),
      pushPayload: {
        title: `🎉 You won ${newItem.name}!`,
        body: `Winning bid: ${usd.format(newItem.winning_bid)}`,
        url: `${APP_URL}/bidding`,
        tag: `won-${newItem.id}`,
      },
    });
    results.push({
      user_id: newItem.winner_user_id,
      outcome: "won",
      ...r,
    });
  }

  // Losing bidders (highest bid per user)
  const { data: bids } = await supabase
    .from("bid_history")
    .select("user_id, amount")
    .eq("item_id", newItem.id);

  const losers = new Map<string, number>();
  for (const b of bids ?? []) {
    if (b.user_id === newItem.winner_user_id) continue;
    const existing = losers.get(b.user_id);
    if (existing === undefined || b.amount > existing) {
      losers.set(b.user_id, b.amount);
    }
  }

  for (const [userId, theirBid] of losers.entries()) {
    const r = await notify({
      userId,
      emailTemplate: lostEmail({
        itemName: newItem.name,
        itemNo: newItem.item_no,
        winningBid: newItem.winning_bid ?? 0,
        yourBid: theirBid,
      }),
      pushPayload: {
        title: `Auction closed: ${newItem.name}`,
        body: `Closed at ${usd.format(newItem.winning_bid ?? 0)}. Your highest bid was ${usd.format(theirBid)}.`,
        url: `${APP_URL}/bidding`,
        tag: `lost-${newItem.id}`,
      },
    });
    results.push({
      user_id: userId,
      outcome: "lost",
      ...r,
    });
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function notify({
  userId,
  emailTemplate,
  pushPayload,
}: {
  userId: string;
  emailTemplate: { subject: string; html: string };
  pushPayload: { title: string; body: string; url?: string; tag?: string };
}): Promise<{ email_sent: boolean; push_sent: number }> {
  const [{ data: auth, error: authErr }, { data: prefs }] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase
      .from("notification_prefs")
      .select("email_optin, push_optin, push_subscriptions")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  let emailSent = false;
  if (auth?.user?.email && !authErr && (!prefs || prefs.email_optin)) {
    const result = await sendEmail(auth.user.email, emailTemplate);
    emailSent = !result.error;
  }

  let pushSent = 0;
  if (prefs?.push_optin && prefs?.push_subscriptions) {
    const subs = prefs.push_subscriptions as PushSubscriptionRecord[];
    if (subs.length > 0) {
      const pushResult = await sendPush(subs, pushPayload);
      pushSent = pushResult.sent;
      await pruneExpiredSubscriptions(
        supabase,
        userId,
        pushResult.expiredEndpoints,
      );
    }
  }

  return { email_sent: emailSent, push_sent: pushSent };
}
