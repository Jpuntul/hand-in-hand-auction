"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type UpdatePrefsResult = { ok: true } | { ok: false; error: string };

export async function updateNotificationPrefs(values: {
  email_optin: boolean;
  push_optin: boolean;
}): Promise<UpdatePrefsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.from("notification_prefs").upsert({
    user_id: user.id,
    email_optin: values.email_optin,
    push_optin: values.push_optin,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/account/notifications");
  return { ok: true };
}
