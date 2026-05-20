"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AdminStatusResult = { ok: true } | { ok: false; error: string };

export async function setAdminStatus(
  userId: string,
  isAdmin: boolean,
): Promise<AdminStatusResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: isAdmin })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  await supabase.rpc("log_audit", {
    p_action: isAdmin ? "admin.user.promote" : "admin.user.revoke",
    p_target_type: "user",
    p_target_id: userId,
    p_metadata: { is_admin: isAdmin },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}
