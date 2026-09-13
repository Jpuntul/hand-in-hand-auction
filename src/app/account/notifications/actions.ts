"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type UpdatePrefsResult = { ok: true } | { ok: false; error: string };

export async function updateNotificationPrefs(values: {
	email_optin: boolean;
}): Promise<UpdatePrefsResult> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { ok: false, error: "Not authenticated" };

	const { error } = await supabase.from("notification_prefs").upsert({
		user_id: user.id,
		email_optin: values.email_optin,
	});

	if (error) return { ok: false, error: error.message };

	revalidatePath("/account/notifications");
	return { ok: true };
}

// ============================================================
// Web Push subscription persistence
// ============================================================

type PushSubscriptionRecord = {
	endpoint: string;
	keys?: { p256dh?: string; auth?: string };
	expirationTime?: number | null;
};

const ALLOWED_PUSH_DOMAINS = [
	"push.apple.com",
	"fcm.googleapis.com",
	"updates.push.services.mozilla.com",
	"notify.windows.com",
	"push.services.mozilla.com",
	"web.push.apple.com",
];

function isValidPushEndpoint(endpoint: string): boolean {
	try {
		const parsed = new URL(endpoint);
		if (parsed.protocol !== "https:") return false;
		const hostname = parsed.hostname.toLowerCase();
		return ALLOWED_PUSH_DOMAINS.some(
			(domain) => hostname === domain || hostname.endsWith(`.${domain}`),
		);
	} catch {
		return false;
	}
}

export async function savePushSubscription(
	subscription: PushSubscriptionRecord,
): Promise<UpdatePrefsResult> {
	if (!subscription?.endpoint || !isValidPushEndpoint(subscription.endpoint)) {
		return { ok: false, error: "Unsupported push service" };
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { ok: false, error: "Not authenticated" };

	// TODO(P2): Fix push_subscriptions read-modify-write race condition (§2.21)
	const { data: existingPrefs } = await supabase
		.from("notification_prefs")
		.select("push_subscriptions")
		.eq("user_id", user.id)
		.maybeSingle();

	const existing =
		(existingPrefs?.push_subscriptions as PushSubscriptionRecord[] | null) ??
		[];
	const next = [
		...existing.filter((s) => s.endpoint !== subscription.endpoint),
		subscription,
	];

	const { error } = await supabase.from("notification_prefs").upsert({
		user_id: user.id,
		push_optin: true,
		push_subscriptions: next,
	});

	if (error) return { ok: false, error: error.message };

	revalidatePath("/account/notifications");
	return { ok: true };
}

export async function removePushSubscription(
	endpoint: string | null,
): Promise<UpdatePrefsResult> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { ok: false, error: "Not authenticated" };

	const { data: existingPrefs } = await supabase
		.from("notification_prefs")
		.select("push_subscriptions")
		.eq("user_id", user.id)
		.maybeSingle();

	const existing =
		(existingPrefs?.push_subscriptions as PushSubscriptionRecord[] | null) ??
		[];
	const next = endpoint ? existing.filter((s) => s.endpoint !== endpoint) : [];

	const { error } = await supabase
		.from("notification_prefs")
		.update({
			push_subscriptions: next,
			push_optin: next.length > 0,
		})
		.eq("user_id", user.id);

	if (error) return { ok: false, error: error.message };

	revalidatePath("/account/notifications");
	return { ok: true };
}
