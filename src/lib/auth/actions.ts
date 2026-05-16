"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = {
  ok: boolean;
  error?: string;
};

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signUpSchema = credentialsSchema.extend({
  displayName: z
    .string()
    .min(1, "Display name is required")
    .max(100, "Display name too long"),
  phone: z.string().max(50).optional(),
});

// ============================================================
// audit logging helper
// ============================================================
async function logAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  const userAgent = (await headers()).get("user-agent") ?? undefined;
  await supabase.rpc("log_audit", {
    p_action: action,
    p_metadata: { ...metadata, user_agent: userAgent },
  });
}

// ============================================================
// Bidder sign-up
// ============================================================
export async function signUpBidder(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName,
        phone: parsed.data.phone ?? null,
      },
    },
  });

  if (error) {
    await logAudit(supabase, "auth.signup.failed", {
      email: parsed.data.email,
      reason: error.message,
    });
    return { ok: false, error: error.message };
  }

  // Profile + notification_prefs are created by the on_auth_user_created
  // trigger, which reads display_name + phone from raw_user_meta_data.

  await logAudit(supabase, "auth.signup.success", {
    email: parsed.data.email,
  });
  redirect("/");
}

// ============================================================
// Bidder sign-in
// ============================================================
export async function signInBidder(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    await logAudit(supabase, "auth.signin.failed", {
      email: parsed.data.email,
      reason: error.message,
    });
    return { ok: false, error: "Invalid email or password" };
  }

  await logAudit(supabase, "auth.signin.success", {
    email: parsed.data.email,
  });
  redirect("/");
}

// ============================================================
// Anonymous bidder
// ============================================================
export async function signInAnonymously(_formData?: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw new Error(error.message);
  }
  redirect("/");
}

// ============================================================
// Admin sign-in
//
// Reads `redirect` from a hidden form field. On success, verifies the
// authenticated user has profiles.is_admin = true; if not, signs them
// back out and returns an access-denied error.
// ============================================================
export async function signInAdmin(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const redirectTo = formData.get("redirect")?.toString() || "/admin";
  const supabase = await createClient();
  const { error, data } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    await logAudit(supabase, "auth.admin.signin.failed", {
      email: parsed.data.email,
      reason: error.message,
    });
    return { ok: false, error: "Invalid email or password" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    await supabase.auth.signOut();
    await logAudit(supabase, "auth.admin.signin.denied", {
      email: parsed.data.email,
    });
    return { ok: false, error: "Access denied: not an admin account." };
  }

  await logAudit(supabase, "auth.admin.signin.success", {
    email: parsed.data.email,
  });
  redirect(redirectTo);
}

// ============================================================
// Sign out
// ============================================================
export async function signOut() {
  const supabase = await createClient();
  await logAudit(supabase, "auth.signout");
  await supabase.auth.signOut();
  redirect("/");
}
