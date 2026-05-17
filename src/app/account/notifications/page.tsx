import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/queries";
import { createClient } from "@/lib/supabase/server";
import { NotificationsForm } from "./notifications-form";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: prefs } = await supabase
    .from("notification_prefs")
    .select("email_optin, push_optin")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="container mx-auto max-w-md space-y-6 py-12 px-4">
      <header>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Control how we reach you about your auction activity.
        </p>
      </header>
      <NotificationsForm
        emailOptin={prefs?.email_optin ?? true}
        pushOptin={prefs?.push_optin ?? false}
      />
    </div>
  );
}
