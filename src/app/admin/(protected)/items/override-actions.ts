"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";

export type OverrideResult = { ok: true } | { ok: false; error: string };

export async function extendDeadline(
	itemId: string,
	minutes: number,
): Promise<OverrideResult> {
	try {
		await requireAdmin();
	} catch {
		return { ok: false, error: "Forbidden" };
	}

	const supabase = await createClient();
	const { error } = await supabase.rpc("extend_deadline", {
		p_item_id: itemId,
		p_minutes: minutes,
	});

	if (error) return { ok: false, error: error.message };

	revalidatePath("/admin/items");
	revalidatePath("/bidding");
	return { ok: true };
}

export async function pauseItem(itemId: string): Promise<OverrideResult> {
	try {
		await requireAdmin();
	} catch {
		return { ok: false, error: "Forbidden" };
	}

	const supabase = await createClient();
	const { error } = await supabase.rpc("pause_item", {
		p_item_id: itemId,
	});

	if (error) return { ok: false, error: error.message };

	revalidatePath("/admin/items");
	revalidatePath("/bidding");
	return { ok: true };
}

export async function resumeItem(itemId: string): Promise<OverrideResult> {
	try {
		await requireAdmin();
	} catch {
		return { ok: false, error: "Forbidden" };
	}

	const supabase = await createClient();
	const { error } = await supabase.rpc("resume_item", {
		p_item_id: itemId,
	});

	if (error) return { ok: false, error: error.message };

	revalidatePath("/admin/items");
	revalidatePath("/bidding");
	return { ok: true };
}

export async function forceCloseItem(itemId: string): Promise<OverrideResult> {
	try {
		await requireAdmin();
	} catch {
		return { ok: false, error: "Forbidden" };
	}

	const supabase = await createClient();
	const { error } = await supabase.rpc("force_close_item", {
		p_item_id: itemId,
	});

	if (error) return { ok: false, error: error.message };

	revalidatePath("/admin/items");
	revalidatePath("/bidding");
	return { ok: true };
}

export async function cancelLastBid(
	itemId: string,
	reason: string,
): Promise<OverrideResult> {
	try {
		await requireAdmin();
	} catch {
		return { ok: false, error: "Forbidden" };
	}

	const supabase = await createClient();
	const { error } = await supabase.rpc("cancel_last_bid", {
		p_item_id: itemId,
		p_reason: reason,
	});

	if (error) return { ok: false, error: error.message };

	revalidatePath("/admin/items");
	revalidatePath("/bidding");
	return { ok: true };
}
