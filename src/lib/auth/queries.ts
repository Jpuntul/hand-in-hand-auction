import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// `cache` dedupes within a single render: multiple components can each call
// getCurrentUser() / getCurrentProfile() without triggering repeat queries.

export const getCurrentUser = cache(async () => {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user;
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
	const user = await getCurrentUser();
	if (!user) return null;

	const supabase = await createClient();
	const { data } = await supabase
		.from("profiles")
		.select("*")
		.eq("id", user.id)
		.maybeSingle();

	return data;
});
