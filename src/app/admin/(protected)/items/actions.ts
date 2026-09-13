"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import {
	type ItemDetailsFormValues,
	type ItemFormValues,
	type ItemScheduleFormValues,
	itemDetailsSchema,
	itemScheduleSchema,
	itemSchema,
} from "./schema";

export type ItemActionResult =
	| { ok: true; id: string }
	| { ok: false; error: string };

export async function createItem(
	values: ItemFormValues,
): Promise<ItemActionResult> {
	try {
		await requireAdmin();
	} catch {
		return { ok: false, error: "Forbidden" };
	}

	const parsed = itemSchema.safeParse(values);
	if (!parsed.success) {
		return {
			ok: false,
			error: parsed.error.issues[0]?.message ?? "Invalid input",
		};
	}

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("items")
		.insert(parsed.data)
		.select("id")
		.single();

	if (error) return { ok: false, error: error.message };

	await supabase.rpc("log_audit", {
		p_action: "admin.item.create",
		p_target_type: "item",
		p_target_id: data.id,
		p_metadata: { item_name: parsed.data.name },
	});

	revalidatePath("/admin/items");
	revalidatePath("/bidding");
	return { ok: true, id: data.id };
}

export async function updateItem(
	id: string,
	values: Partial<ItemFormValues> | Partial<ItemDetailsFormValues>,
): Promise<ItemActionResult> {
	try {
		await requireAdmin();
	} catch {
		return { ok: false, error: "Forbidden" };
	}

	// Strip lifecycle columns so generic edit form cannot clobber live auction state
	const sanitized: Record<string, unknown> = { ...values };
	delete sanitized.status;
	delete sanitized.start_time;
	delete sanitized.end_time;
	delete sanitized.current_bid;
	delete sanitized.current_bidder_id;
	delete sanitized.bid_count;
	delete sanitized.winner_user_id;
	delete sanitized.winning_bid;
	delete sanitized.id;
	delete sanitized.created_at;
	delete sanitized.updated_at;

	const parsed = itemDetailsSchema.partial().safeParse(sanitized);
	if (!parsed.success) {
		return {
			ok: false,
			error: parsed.error.issues[0]?.message ?? "Invalid input",
		};
	}

	if (Object.keys(parsed.data).length === 0) {
		return { ok: true, id };
	}

	const supabase = await createClient();
	const { data, error } = await supabase
		.from("items")
		.update(parsed.data)
		.eq("id", id)
		.select("id, name");

	if (error) return { ok: false, error: error.message };
	if (!data || data.length === 0) {
		return { ok: false, error: "Not found or not permitted" };
	}

	await supabase.rpc("log_audit", {
		p_action: "admin.item.update",
		p_target_type: "item",
		p_target_id: id,
		p_metadata: { item_name: data[0]?.name ?? parsed.data.name ?? null },
	});

	revalidatePath("/admin/items");
	revalidatePath(`/admin/items/${id}/edit`);
	revalidatePath("/bidding");
	return { ok: true, id };
}

export async function updateItemSchedule(
	id: string,
	values: ItemScheduleFormValues,
): Promise<ItemActionResult> {
	try {
		await requireAdmin();
	} catch {
		return { ok: false, error: "Forbidden" };
	}

	const parsed = itemScheduleSchema.safeParse(values);
	if (!parsed.success) {
		return {
			ok: false,
			error: parsed.error.issues[0]?.message ?? "Invalid input",
		};
	}

	// Schedule update may set status only among scheduled | open | paused
	if (
		parsed.data.status !== "scheduled" &&
		parsed.data.status !== "open" &&
		parsed.data.status !== "paused"
	) {
		return {
			ok: false,
			error:
				"Status may only be set to scheduled, open, or paused via schedule form. Use override actions for closed or cancelled.",
		};
	}

	const supabase = await createClient();

	// If item is currently open, start_time cannot be modified
	const { data: existing, error: fetchError } = await supabase
		.from("items")
		.select("id, name, status, start_time, end_time")
		.eq("id", id)
		.maybeSingle();

	if (fetchError) return { ok: false, error: fetchError.message };
	if (!existing) return { ok: false, error: "Not found or not permitted" };

	const updatePayload: {
		status: "scheduled" | "open" | "paused";
		start_time?: string | null;
		end_time: string | null;
	} = {
		status: parsed.data.status as "scheduled" | "open" | "paused",
		end_time: parsed.data.end_time,
	};

	// When item is open, start_time is read-only (preserve existing start_time)
	if (existing.status === "open") {
		updatePayload.start_time = existing.start_time;
	} else {
		updatePayload.start_time = parsed.data.start_time;
	}

	const { data, error } = await supabase
		.from("items")
		.update(updatePayload)
		.eq("id", id)
		.select("id, name");

	if (error) return { ok: false, error: error.message };
	if (!data || data.length === 0) {
		return { ok: false, error: "Not found or not permitted" };
	}

	await supabase.rpc("log_audit", {
		p_action: "admin.item.update_schedule",
		p_target_type: "item",
		p_target_id: id,
		p_metadata: {
			item_name: data[0]?.name ?? existing.name,
			status: updatePayload.status,
			start_time: updatePayload.start_time,
			end_time: updatePayload.end_time,
		},
	});

	revalidatePath("/admin/items");
	revalidatePath(`/admin/items/${id}/edit`);
	revalidatePath("/bidding");
	return { ok: true, id };
}

export async function deleteItem(
	id: string,
): Promise<{ ok: boolean; error?: string }> {
	try {
		await requireAdmin();
	} catch {
		return { ok: false, error: "Forbidden" };
	}

	const supabase = await createClient();
	const { data: item, error: fetchError } = await supabase
		.from("items")
		.select("bid_count")
		.eq("id", id)
		.maybeSingle();

	if (fetchError) return { ok: false, error: fetchError.message };
	if (!item) return { ok: false, error: "Not found or not permitted" };

	if (item.bid_count > 0) {
		return {
			ok: false,
			error:
				"Items with bids cannot be deleted — set status to cancelled instead.",
		};
	}

	const { data, error } = await supabase
		.from("items")
		.delete()
		.eq("id", id)
		.select("id, name");

	if (error) return { ok: false, error: error.message };
	if (!data || data.length === 0) {
		return { ok: false, error: "Not found or not permitted" };
	}

	await supabase.rpc("log_audit", {
		p_action: "admin.item.delete",
		p_target_type: "item",
		p_target_id: id,
		p_metadata: { item_name: data[0]?.name ?? null },
	});

	revalidatePath("/admin/items");
	revalidatePath("/bidding");
	return { ok: true };
}
