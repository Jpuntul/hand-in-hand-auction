"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type UpdateProfileResult = { ok: true } | { ok: false; error: string };

export async function updateProfile(values: {
  display_name: string;
  phone: string;
}): Promise<UpdateProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: values.display_name.trim() || null,
      phone: values.phone.trim() || null,
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  // Bust caches that read the profile so the new display_name shows up
  // in the UserMenu / bid history immediately.
  revalidatePath("/account/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}
