// Webhook fired by Supabase Database Webhooks on every UPDATE of
// public.items. Sends "you won" / "you lost" emails when status transitions
// to 'closed'. Ignores every other update silently.
//
// Payload format (Supabase Database Webhook):
//   { type: "UPDATE", table: "items", schema: "public",
//     record: <new row>, old_record: <old row> }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { lostEmail, sendEmail, wonEmail } from "../_shared/email.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type EmailOutcome = {
  user_id: string;
  outcome: "won" | "lost";
  sent: boolean;
  error?: unknown;
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

  // Only fire on the open→closed transition.
  if (oldItem.status === "closed" || newItem.status !== "closed") {
    return new Response("Not a closing transition", {
      status: 200,
      headers: corsHeaders,
    });
  }

  const results: EmailOutcome[] = [];

  // 1) Email the winner.
  if (newItem.winner_user_id && newItem.winning_bid != null) {
    const sent = await maybeSend({
      userId: newItem.winner_user_id,
      template: wonEmail({
        itemName: newItem.name,
        itemNo: newItem.item_no,
        winningBid: newItem.winning_bid,
      }),
    });
    results.push({
      user_id: newItem.winner_user_id,
      outcome: "won",
      sent: !!sent.sent,
      error: sent.error,
    });
  }

  // 2) Email all losing bidders (highest bid per user).
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
    const sent = await maybeSend({
      userId,
      template: lostEmail({
        itemName: newItem.name,
        itemNo: newItem.item_no,
        winningBid: newItem.winning_bid ?? 0,
        yourBid: theirBid,
      }),
    });
    results.push({
      user_id: userId,
      outcome: "lost",
      sent: !!sent.sent,
      error: sent.error,
    });
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function maybeSend({
  userId,
  template,
}: {
  userId: string;
  template: { subject: string; html: string };
}): Promise<{ sent: boolean; error?: unknown }> {
  const [{ data: auth, error: authErr }, { data: prefs }] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase
      .from("notification_prefs")
      .select("email_optin")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (authErr || !auth?.user?.email) return { sent: false, error: authErr };
  if (prefs && !prefs.email_optin) return { sent: false };
  const result = await sendEmail(auth.user.email, template);
  if (result.error) return { sent: false, error: result.error };
  return { sent: true };
}
