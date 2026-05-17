// deno-lint-ignore-file no-explicit-any
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "noreply@example.com";

// Extract `email@example.com` from "Display Name <email@example.com>"
const contactMatch = EMAIL_FROM.match(/<([^>]+)>/);
const contactEmail = contactMatch ? contactMatch[1] : EMAIL_FROM;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${contactEmail}`,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
} else {
  console.warn(
    "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — push delivery will be skipped.",
  );
}

export type PushSubscriptionRecord = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
  expirationTime?: number | null;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type PushResult = {
  sent: number;
  failed: number;
  expiredEndpoints: string[];
};

export async function sendPush(
  subscriptions: PushSubscriptionRecord[],
  payload: PushPayload,
): Promise<PushResult> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { sent: 0, failed: 0, expiredEndpoints: [] };
  }
  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, expiredEndpoints: [] };
  }

  const message = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const expired: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub as any, message);
        sent++;
      } catch (err: any) {
        failed++;
        // 404/410 — endpoint is gone (user uninstalled, revoked permission, etc.)
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expired.push(sub.endpoint);
        }
        console.warn(
          `Push delivery failed for ${sub.endpoint}: status=${err?.statusCode} body=${err?.body}`,
        );
      }
    }),
  );

  return { sent, failed, expiredEndpoints: expired };
}

/**
 * Strips expired-endpoint subscriptions from a user's notification_prefs.
 * Pass the supabase client (caller already has one initialised).
 */
export async function pruneExpiredSubscriptions(
  supabase: any,
  userId: string,
  expiredEndpoints: string[],
): Promise<void> {
  if (expiredEndpoints.length === 0) return;

  const { data } = await supabase
    .from("notification_prefs")
    .select("push_subscriptions")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.push_subscriptions) return;
  const existing = data.push_subscriptions as PushSubscriptionRecord[];
  const remaining = existing.filter(
    (s) => !expiredEndpoints.includes(s.endpoint),
  );

  await supabase
    .from("notification_prefs")
    .update({
      push_subscriptions: remaining,
      push_optin: remaining.length > 0,
    })
    .eq("user_id", userId);
}
