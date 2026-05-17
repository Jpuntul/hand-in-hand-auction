// Webhook fired by Supabase Database Webhooks on every INSERT into
// public.bid_history. Notifies the previous bidder that they've been
// outbid — via email (if email_optin) and via Web Push (if push_optin).
//
// Payload format (Supabase Database Webhook):
//   { type: "INSERT", table: "bid_history", schema: "public",
//     record: <new row>, old_record: null }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { outbidEmail, sendEmail } from "../_shared/email.ts";
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
  if (
    !payload ||
    payload.type !== "INSERT" ||
    payload.table !== "bid_history"
  ) {
    return new Response("Ignored", { status: 200, headers: corsHeaders });
  }

  const bid = payload.record as {
    item_id: string;
    user_id: string;
    amount: number;
    previous_bidder_id: string | null;
    previous_bid: number | null;
  };

  if (!bid.previous_bidder_id || bid.previous_bidder_id === bid.user_id) {
    return new Response("No outbid recipient", {
      status: 200,
      headers: corsHeaders,
    });
  }

  const [
    { data: prevBidderAuth, error: authErr },
    { data: prefs },
    { data: item },
  ] = await Promise.all([
    supabase.auth.admin.getUserById(bid.previous_bidder_id),
    supabase
      .from("notification_prefs")
      .select("email_optin, push_optin, push_subscriptions")
      .eq("user_id", bid.previous_bidder_id)
      .maybeSingle(),
    supabase
      .from("items")
      .select("name, item_no")
      .eq("id", bid.item_id)
      .maybeSingle(),
  ]);

  if (authErr || !prevBidderAuth?.user) {
    return new Response(
      `Previous bidder lookup failed: ${authErr?.message ?? "unknown"}`,
      { status: 200, headers: corsHeaders },
    );
  }
  if (!item) {
    return new Response("Item not found", {
      status: 200,
      headers: corsHeaders,
    });
  }

  const results: Record<string, unknown> = {};

  // Email
  if (prevBidderAuth.user.email && (!prefs || prefs.email_optin)) {
    const emailResult = await sendEmail(
      prevBidderAuth.user.email,
      outbidEmail({
        itemName: item.name,
        itemNo: item.item_no,
        newBid: bid.amount,
        previousBid: bid.previous_bid ?? 0,
      }),
    );
    results.email = emailResult;
  }

  // Web Push
  if (prefs?.push_optin && prefs?.push_subscriptions) {
    const subs = prefs.push_subscriptions as PushSubscriptionRecord[];
    if (subs.length > 0) {
      const pushResult = await sendPush(subs, {
        title: "You've been outbid",
        body: `New bid on ${item.name}: ${usd.format(bid.amount)}`,
        url: `${APP_URL}/bidding`,
        tag: `outbid-${bid.item_id}`,
      });
      results.push = pushResult;
      await pruneExpiredSubscriptions(
        supabase,
        bid.previous_bidder_id,
        pushResult.expiredEndpoints,
      );
    }
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
