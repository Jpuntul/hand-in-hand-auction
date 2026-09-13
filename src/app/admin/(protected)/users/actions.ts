"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";

export type AdminStatusResult = { ok: true } | { ok: false; error: string };

export async function setAdminStatus(
	userId: string,
	isAdmin: boolean,
): Promise<AdminStatusResult> {
	try {
		await requireAdmin();
	} catch {
		return { ok: false, error: "Forbidden" };
	}

	const supabase = await createClient();

	const { data, error } = await supabase
		.from("profiles")
		.update({ is_admin: isAdmin })
		.eq("id", userId)
		.select("id");

	if (error) return { ok: false, error: error.message };
	if (!data || data.length === 0) {
		return { ok: false, error: "Not found or not permitted" };
	}

	await supabase.rpc("log_audit", {
		p_action: isAdmin ? "admin.user.promote" : "admin.user.revoke",
		p_target_type: "user",
		p_target_id: userId,
		p_metadata: { is_admin: isAdmin },
	});

	revalidatePath("/admin/users");
	return { ok: true };
}
