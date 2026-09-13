// Webhook fired by Supabase Database Webhooks on UPDATE of
// public.items when status transitions to 'closed' or 'cancelled'.
//
// Sends "you won" / "you lost" notifications on close, and cancellation
// notices on open|paused -> cancelled. Ignores every other update.
//
// Payload format (Supabase Database Webhook):
//   { type: "UPDATE", table: "items", schema: "public",
//     record: <new row>, old_record: <old row> }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { requireWebhookSecret } from "../_shared/auth.ts";
import {
  cancelledEmail,
  lostEmail,
  sendEmail,
  wonEmail,
} from "../_shared/email.ts";
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

type NotificationTarget = {
  userId: string;
  role: "winner" | "loser" | "cancelled";
  emailTemplate: { subject: string; html: string };
  pushPayload: { title: string; body: string; url?: string; tag?: string };
};

type NotificationResult = {
  userId: string;
  role: "winner" | "loser" | "cancelled";
  email_sent: boolean;
  email_failed: boolean;
  push_sent: number;
  push_failed: number;
};

/**
 * Runs tasks with a bounded concurrency pool.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      try {
        const val = await fn(items[idx]);
        results[idx] = { status: "fulfilled", value: val };
      } catch (err) {
        results[idx] = { status: "rejected", reason: err };
      }
    }
  }

  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return results;
}

Deno.serve(async (req) => {
  // D1: Shared-secret gate
  const authResponse = requireWebhookSecret(req);
  if (authResponse) {
    return authResponse;
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload || payload.type !== "UPDATE" || payload.table !== "items") {
    return new Response("Ignored", { status: 200 });
  }

  const recordId = payload.record?.id;
  if (!recordId) {
    return new Response("Missing record id", { status: 400 });
  }
  const oldStatus = payload.old_record?.status as string | undefined;

  // D2: Trust the DB, not the payload. Re-read row directly using service-role client.
  const { data: item, error: itemErr } = await supabase
    .from("items")
    .select("id, name, item_no, status, winner_user_id, winning_bid, notified_at")
    .eq("id", recordId)
    .maybeSingle();

  if (itemErr || !item) {
    return new Response("Item not found", { status: 200 });
  }

  // D3: Idempotency check before doing any work
  if (item.notified_at !== null) {
    return new Response("Already notified", { status: 200 });
  }

  // D5: Check valid transition: closed or open|paused -> cancelled
  const isCloseTransition = oldStatus !== "closed" && item.status === "closed";
  const isCancelTransition =
    (oldStatus === "open" || oldStatus === "paused") &&
    item.status === "cancelled";

  if (!isCloseTransition && !isCancelTransition) {
    return new Response("Not a closing or cancellation transition", {
      status: 200,
    });
  }

  // D3: Atomic claim on notified_at before any send
  const { data: claimed, error: claimErr } = await supabase
    .from("items")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", item.id)
    .is("notified_at", null)
    .select("id");

  if (claimErr) {
    console.error("Failed to claim notification:", claimErr);
    return new Response("Error claiming notification", { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    return new Response("Already notified", { status: 200 });
  }

  // Query bids for this item (DB-2: ignore cancelled bids)
  const { data: bids } = await supabase
    .from("bid_history")
    .select("user_id, amount")
    .eq("item_id", item.id)
    .is("cancelled_at", null);

  const targets: NotificationTarget[] = [];

  if (isCloseTransition) {
    // Winner first (targets[0])
    if (item.winner_user_id && item.winning_bid != null) {
      targets.push({
        userId: item.winner_user_id,
        role: "winner",
        emailTemplate: wonEmail({
          itemName: item.name,
          itemNo: item.item_no,
          winningBid: item.winning_bid,
        }),
        pushPayload: {
          title: `🎉 You won ${item.name}!`,
          body: `Winning bid: ${usd.format(item.winning_bid)}`,
          url: `${APP_URL}/bidding`,
          tag: `won-${item.id}`,
        },
      });
    }

    // Losers: highest bid per loser
    const losers = new Map<string, number>();
    for (const b of bids ?? []) {
      if (b.user_id === item.winner_user_id) continue;
      const existing = losers.get(b.user_id);
      if (existing === undefined || b.amount > existing) {
        losers.set(b.user_id, b.amount);
      }
    }

    for (const [userId, theirBid] of losers.entries()) {
      targets.push({
        userId,
        role: "loser",
        emailTemplate: lostEmail({
          itemName: item.name,
          itemNo: item.item_no,
          winningBid: item.winning_bid ?? 0,
          yourBid: theirBid,
        }),
        pushPayload: {
          title: `Auction closed: ${item.name}`,
          body: `Closed at ${usd.format(item.winning_bid ?? 0)}. Your highest bid was ${usd.format(theirBid)}.`,
          url: `${APP_URL}/bidding`,
          tag: `lost-${item.id}`,
        },
      });
    }
  } else if (isCancelTransition) {
    // Distinct bidders
    const bidderIds = Array.from(new Set((bids ?? []).map((b) => b.user_id)));
    for (const userId of bidderIds) {
      targets.push({
        userId,
        role: "cancelled",
        emailTemplate: cancelledEmail({
          itemName: item.name,
          itemNo: item.item_no,
        }),
        pushPayload: {
          title: `Auction cancelled: ${item.name}`,
          body: `The auction for ${item.name} was cancelled by the organisers.`,
          url: `${APP_URL}/bidding`,
          tag: `cancelled-${item.id}`,
        },
      });
    }
  }

  // D4: Batched fan-out. Pre-fetch notification_prefs for all target users.
  const allUserIds = targets.map((t) => t.userId);
  const prefsMap = new Map<
    string,
    {
      user_id: string;
      email_optin: boolean;
      push_optin: boolean;
      push_subscriptions: PushSubscriptionRecord[];
    }
  >();

  if (allUserIds.length > 0) {
    const { data: prefsList } = await supabase
      .from("notification_prefs")
      .select("user_id, email_optin, push_optin, push_subscriptions")
      .in("user_id", allUserIds);

    if (prefsList) {
      for (const p of prefsList) {
        prefsMap.set(p.user_id, p as any);
      }
    }
  }

  // Send with bounded concurrency (pool of 5) using Promise.allSettled
  const settledResults = await runWithConcurrency<
    NotificationTarget,
    NotificationResult
  >(targets, 5, async (target) => {
    const prefs = prefsMap.get(target.userId);
    let emailSent = false;
    let emailFailed = false;

    // Email delivery (DB-9: keep auth.admin as authoritative source of email)
    if (!prefs || prefs.email_optin) {
      try {
        const { data: auth, error: authErr } =
          await supabase.auth.admin.getUserById(target.userId);

        if (!authErr && auth?.user?.email) {
          const emailRes = await sendEmail(
            auth.user.email,
            target.emailTemplate,
          );
          if (emailRes.error) {
            emailFailed = true;
          } else {
            emailSent = true;
          }
        } else {
          emailFailed = true;
        }
      } catch (err) {
        console.error(`Email delivery error for ${target.userId}:`, err);
        emailFailed = true;
      }
    }

    // Web Push delivery
    let pushSent = 0;
    let pushFailed = 0;

    if (prefs?.push_optin && prefs?.push_subscriptions) {
      const subs = prefs.push_subscriptions as PushSubscriptionRecord[];
      if (subs.length > 0) {
        try {
          const pushRes = await sendPush(subs, target.pushPayload);
          pushSent = pushRes.sent;
          pushFailed = pushRes.failed;
          if (pushRes.expiredEndpoints.length > 0) {
            await pruneExpiredSubscriptions(
              supabase,
              target.userId,
              pushRes.expiredEndpoints,
            );
          }
        } catch (err) {
          console.error(`Push delivery error for ${target.userId}:`, err);
          pushFailed = subs.length;
        }
      }
    }

    return {
      userId: target.userId,
      role: target.role,
      email_sent: emailSent,
      email_failed: emailFailed,
      push_sent: pushSent,
      push_failed: pushFailed,
    };
  });

  // Calculate summary metrics
  let wonCount = 0;
  let lostCount = 0;
  let cancelledCount = 0;
  let emailOkCount = 0;
  let emailFailCount = 0;
  let pushOkCount = 0;
  let pushFailCount = 0;

  for (const settled of settledResults) {
    if (settled.status === "fulfilled") {
      const val = settled.value;
      if (val.role === "winner") wonCount++;
      else if (val.role === "loser") lostCount++;
      else if (val.role === "cancelled") cancelledCount++;

      if (val.email_sent) emailOkCount++;
      if (val.email_failed) emailFailCount++;
      pushOkCount += val.push_sent;
      pushFailCount += val.push_failed;
    } else {
      emailFailCount++;
    }
  }

  const summary = {
    item_id: item.id,
    won: wonCount,
    lost: lostCount,
    cancelled: cancelledCount,
    email_ok: emailOkCount,
    email_fail: emailFailCount,
    push_ok: pushOkCount,
    push_fail: pushFailCount,
  };

  // D4: Summary line log
  console.log("Notification summary:", JSON.stringify(summary));

  // Audit log entry (AUDIT §2.17)
  try {
    await supabase.from("audit_log").insert({
      action: isCloseTransition
        ? "notification.auction_closed"
        : "notification.auction_cancelled",
      target_type: "item",
      target_id: item.id,
      metadata: summary,
    });
  } catch (err) {
    console.warn("Failed to write audit log entry:", err);
  }

  return new Response(JSON.stringify({ ok: true, summary }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
