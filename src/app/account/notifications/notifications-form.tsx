"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateNotificationPrefs } from "./actions";

export function NotificationsForm({
  emailOptin,
  pushOptin,
}: {
  emailOptin: boolean;
  pushOptin: boolean;
}) {
  const [email, setEmail] = useState(emailOptin);
  const [push, setPush] = useState(pushOptin);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const result = await updateNotificationPrefs({
      email_optin: email,
      push_optin: push,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Preferences saved");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email notifications</CardTitle>
        <CardDescription>
          We only email you about events that affect you directly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <Label htmlFor="email">Email me when…</Label>
            <p className="text-xs text-muted-foreground">
              I'm outbid · An auction I bid on closes
            </p>
          </div>
          <Switch id="email" checked={email} onCheckedChange={setEmail} />
        </div>

        <div className="flex items-center justify-between gap-3 opacity-50">
          <div className="space-y-0.5">
            <Label htmlFor="push">Browser push notifications</Label>
            <p className="text-xs text-muted-foreground">
              Instant alerts even when this tab is closed (coming in a later
              phase)
            </p>
          </div>
          <Switch id="push" checked={push} onCheckedChange={setPush} disabled />
        </div>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </CardContent>
    </Card>
  );
}
