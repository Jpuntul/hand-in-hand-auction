// Webhook fired by Supabase Database Webhooks on every INSERT into
// public.bid_history. Sends an outbid email to the previous bidder
// (if any) unless they opted out.
//
// Payload format (Supabase Database Webhook):
//   { type: "INSERT", table: "bid_history", schema: "public",
//     record: <new row>, old_record: null }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { outbidEmail, sendEmail } from "../_shared/email.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

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

  // First bid on the item, or same bidder raising their own bid — nothing to do.
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
      .select("email_optin")
      .eq("user_id", bid.previous_bidder_id)
      .maybeSingle(),
    supabase
      .from("items")
      .select("name, item_no")
      .eq("id", bid.item_id)
      .maybeSingle(),
  ]);

  if (authErr || !prevBidderAuth?.user?.email) {
    return new Response(
      `Previous bidder lookup failed: ${authErr?.message ?? "no email"}`,
      { status: 200, headers: corsHeaders },
    );
  }
  if (prefs && !prefs.email_optin) {
    return new Response("User opted out of email", {
      status: 200,
      headers: corsHeaders,
    });
  }
  if (!item) {
    return new Response("Item not found", {
      status: 200,
      headers: corsHeaders,
    });
  }

  const result = await sendEmail(
    prevBidderAuth.user.email,
    outbidEmail({
      itemName: item.name,
      itemNo: item.item_no,
      newBid: bid.amount,
      previousBid: bid.previous_bid ?? 0,
    }),
  );

  return new Response(JSON.stringify({ sent: !result.error, ...result }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
