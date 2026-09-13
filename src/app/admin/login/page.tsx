import { redirect } from "next/navigation";

import { SiteShell } from "@/components/site-shell";
import { getCurrentProfile } from "@/lib/auth/queries";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { AdminLoginForm } from "./admin-login-form";

export default async function AdminLoginPage({
	searchParams,
}: {
	searchParams: Promise<{ redirect?: string }>;
}) {
	const [profile, { redirect: rawRedirect }] = await Promise.all([
		getCurrentProfile(),
		searchParams,
	]);

	const redirectTo = safeRedirectPath(rawRedirect, "/admin");

	if (profile?.is_admin) {
		redirect(redirectTo);
	}

	return (
		<SiteShell size="narrow" user={null} brand="Hand in Hand · Admin">
			<AdminLoginForm redirectTo={redirectTo} />
		</SiteShell>
	);
}
