"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ToggleWatchResult =
  | { ok: true; watched: boolean }
  | { ok: false; error: string };

export async function toggleWatchlist(
  itemId: string,
): Promise<ToggleWatchResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to use watchlist" };

  const { data: existing } = await supabase
    .from("watchlist")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("item_id", itemId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("watchlist")
      .delete()
      .eq("user_id", user.id)
      .eq("item_id", itemId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/account/watchlist");
    return { ok: true, watched: false };
  }

  const { error } = await supabase
    .from("watchlist")
    .insert({ user_id: user.id, item_id: itemId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/account/watchlist");
  return { ok: true, watched: true };
}
