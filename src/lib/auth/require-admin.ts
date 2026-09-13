import "server-only";

import { getCurrentProfile } from "@/lib/auth/queries";
import type { Profile } from "@/lib/types";

export async function requireAdmin(): Promise<Profile> {
	const profile = await getCurrentProfile();
	if (!profile?.is_admin) {
		throw new Error("Forbidden");
	}
	return profile;
}
