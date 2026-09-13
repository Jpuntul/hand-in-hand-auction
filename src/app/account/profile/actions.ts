"use server";

import { revalidatePath } from "next/cache";

import { profileFieldsSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";

export type UpdateProfileResult = { ok: true } | { ok: false; error: string };

export async function updateProfile(values: {
	display_name: string;
	phone: string;
}): Promise<UpdateProfileResult> {
	const parsed = profileFieldsSchema.safeParse(values);
	if (!parsed.success) {
		return {
			ok: false,
			error: parsed.error.issues[0]?.message ?? "Invalid input",
		};
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { ok: false, error: "Not authenticated" };

	const { data, error } = await supabase
		.from("profiles")
		.update({
			display_name: parsed.data.display_name,
			phone: parsed.data.phone,
		})
		.eq("id", user.id)
		.select("id");

	if (error) return { ok: false, error: error.message };
	if (!data || data.length === 0) {
		return { ok: false, error: "Not found or not permitted" };
	}

	// Bust caches that read the profile so the new display_name shows up
	// in the UserMenu / bid history immediately.
	revalidatePath("/account/profile");
	revalidatePath("/", "layout");
	return { ok: true };
}
