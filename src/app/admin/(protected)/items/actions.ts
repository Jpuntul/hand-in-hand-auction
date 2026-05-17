"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { itemSchema, type ItemFormValues } from "./schema";

export type ItemActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createItem(
  values: ItemFormValues,
): Promise<ItemActionResult> {
  const parsed = itemSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/items");
  revalidatePath("/bidding");
  return { ok: true, id: data.id };
}

export async function updateItem(
  id: string,
  values: ItemFormValues,
): Promise<ItemActionResult> {
  const parsed = itemSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("items").update(parsed.data).eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/items");
  revalidatePath(`/admin/items/${id}/edit`);
  revalidatePath("/bidding");
  return { ok: true, id };
}

export async function deleteItem(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("items").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/items");
  revalidatePath("/bidding");
  return { ok: true };
}
