import "server-only";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/queries";

/**
 * Server component that ensures the current user is an admin.
 *
 * The Next.js middleware already redirects unauthenticated requests for
 * /admin/* routes; this guard handles the second case — authenticated but
 * lacking the admin role.
 */
export async function AdminGuard({ children }: { children: React.ReactNode }) {
	const profile = await getCurrentProfile();
	if (!profile?.is_admin) {
		redirect("/admin/login");
	}
	return <>{children}</>;
}
