"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type OverrideResult = { ok: true } | { ok: false; error: string };

async function logAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: string,
  itemId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta: Record<string, any> = {},
) {
  await supabase.rpc("log_audit", {
    p_action: action,
    p_target_type: "item",
    p_target_id: itemId,
    p_metadata: meta,
  });
}

export async function extendDeadline(
  itemId: string,
  minutes: number,
): Promise<OverrideResult> {
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("items")
    .select("end_time, name")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { ok: false, error: "Item not found" };

  const base = item.end_time ? new Date(item.end_time) : new Date();
  const newEnd = new Date(base.getTime() + minutes * 60_000).toISOString();

  const { error } = await supabase
    .from("items")
    .update({ end_time: newEnd })
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message };

  await logAudit(supabase, "admin.item.extend_deadline", itemId, {
    item_name: item.name,
    minutes_added: minutes,
    new_end_time: newEnd,
  });
  revalidatePath("/admin/items");
  revalidatePath("/bidding");
  return { ok: true };
}

export async function pauseItem(itemId: string): Promise<OverrideResult> {
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("items")
    .select("name, status")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { ok: false, error: "Item not found" };
  if (item.status !== "open")
    return { ok: false, error: "Only open items can be paused" };

  const { error } = await supabase
    .from("items")
    .update({ status: "scheduled" })
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message };

  await logAudit(supabase, "admin.item.pause", itemId, {
    item_name: item.name,
  });
  revalidatePath("/admin/items");
  revalidatePath("/bidding");
  return { ok: true };
}

export async function forceCloseItem(itemId: string): Promise<OverrideResult> {
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("items")
    .select("name, current_bidder_id, current_bid")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { ok: false, error: "Item not found" };

  const { error } = await supabase
    .from("items")
    .update({
      status: "closed",
      winner_user_id: item.current_bidder_id,
      winning_bid: item.current_bid,
    })
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message };

  await logAudit(supabase, "admin.item.force_close", itemId, {
    item_name: item.name,
    winning_bid: item.current_bid,
  });
  revalidatePath("/admin/items");
  revalidatePath("/bidding");
  return { ok: true };
}

export async function cancelLastBid(
  itemId: string,
  reason: string,
): Promise<OverrideResult> {
  const supabase = await createClient();

  // 1. Fetch the most recent bid
  const { data: lastBid } = await supabase
    .from("bid_history")
    .select("id, amount, previous_bidder_id, previous_bid")
    .eq("item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lastBid) return { ok: false, error: "No bids to cancel" };

  // 2. Fetch current bid_count
  const { data: current } = await supabase
    .from("items")
    .select("bid_count")
    .eq("id", itemId)
    .maybeSingle();

  // 3. Delete the bid record
  const { error: delErr } = await supabase
    .from("bid_history")
    .delete()
    .eq("id", lastBid.id);
  if (delErr) return { ok: false, error: delErr.message };

  // 4. Restore item to its previous bid state
  const { error: updErr } = await supabase
    .from("items")
    .update({
      current_bid: lastBid.previous_bid,
      current_bidder_id: lastBid.previous_bidder_id,
      bid_count: Math.max(0, (current?.bid_count ?? 1) - 1),
    })
    .eq("id", itemId);
  if (updErr) return { ok: false, error: updErr.message };

  // 5. Audit log
  await logAudit(supabase, "admin.item.cancel_bid", itemId, {
    reason,
    cancelled_bid_id: lastBid.id,
    cancelled_amount: lastBid.amount,
  });

  revalidatePath("/admin/items");
  revalidatePath("/bidding");
  return { ok: true };
}
