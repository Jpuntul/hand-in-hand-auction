import { redirect } from "next/navigation";

import { SiteShell } from "@/components/site-shell";
import { getCurrentUser } from "@/lib/auth/queries";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
	const user = await getCurrentUser();
	if (user) redirect("/");

	return (
		<SiteShell size="narrow" user={null}>
			<LoginForm />
		</SiteShell>
	);
}
