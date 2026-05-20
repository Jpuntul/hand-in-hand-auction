"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { setAdminStatus } from "./actions";

export function AdminToggle({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}) {
  const [value, setValue] = useState(isAdmin);
  const [busy, setBusy] = useState(false);

  const toggle = async (next: boolean) => {
    if (
      !confirm(
        next
          ? "Grant admin access to this user?"
          : "Revoke admin access from this user?",
      )
    )
      return;
    setValue(next); // optimistic
    setBusy(true);
    const result = await setAdminStatus(userId, next);
    setBusy(false);
    if (!result.ok) {
      setValue(!next); // revert
      toast.error(result.error);
    } else {
      toast.success(next ? "Admin access granted" : "Admin access revoked");
    }
  };

  return (
    <Switch checked={value} onCheckedChange={toggle} disabled={busy} />
  );
}
