import type { Database } from "@/lib/supabase/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Item = Database["public"]["Tables"]["items"]["Row"];
export type ItemStatus = Database["public"]["Enums"]["item_status"];
export type BidHistory = Database["public"]["Tables"]["bid_history"]["Row"];
export type NotificationPrefs =
  Database["public"]["Tables"]["notification_prefs"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_log"]["Row"];
