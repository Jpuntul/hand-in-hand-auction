import { redirect } from "next/navigation";

import { SiteShell } from "@/components/site-shell";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/queries";
import { createClient } from "@/lib/supabase/server";
import { NotificationsForm } from "./notifications-form";

export default async function NotificationsPage() {
	const [user, profile] = await Promise.all([
		getCurrentUser(),
		getCurrentProfile(),
	]);
	if (!user) redirect("/login");

	const supabase = await createClient();
	const { data: prefs } = await supabase
		.from("notification_prefs")
		.select("email_optin, push_optin")
		.eq("user_id", user.id)
		.maybeSingle();

	return (
		<SiteShell
			size="narrow"
			user={{
				email: user.email ?? null,
				displayName: profile?.display_name ?? null,
				isAdmin: profile?.is_admin ?? false,
			}}
		>
			<div className="space-y-6">
				<section>
					<h1 className="text-2xl font-bold sm:text-3xl">Notifications</h1>
					<p className="text-sm text-muted-foreground">
						Control how we reach you about your auction activity.
					</p>
				</section>
				<NotificationsForm
					emailOptin={prefs?.email_optin ?? true}
					pushOptin={prefs?.push_optin ?? false}
				/>
			</div>
		</SiteShell>
	);
}
