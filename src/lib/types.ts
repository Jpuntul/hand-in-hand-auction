import type { Database } from "@/lib/supabase/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Item = Database["public"]["Tables"]["items"]["Row"];
export type ItemStatus = Database["public"]["Enums"]["item_status"];
export type ItemCategory = Database["public"]["Enums"]["categories"];
export type BidHistory = Database["public"]["Tables"]["bid_history"]["Row"];
export type NotificationPrefs =
  Database["public"]["Tables"]["notification_prefs"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_log"]["Row"];

// Runtime constants — derive from `as const` arrays so callers can iterate.
// Values must match the database enums (typecheck below catches drift).
export const ITEM_STATUSES = [
  "scheduled",
  "open",
  "closed",
  "cancelled",
] as const satisfies readonly ItemStatus[];

export const ITEM_CATEGORIES = [
  "sport",
  "hotel",
  "food",
] as const satisfies readonly ItemCategory[];
