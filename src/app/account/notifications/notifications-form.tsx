"use client";

import { useEffect, useState } from "react";
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
import {
	getPushPermission,
	isPushSupported,
	subscribeToPush,
	unsubscribeFromPush,
} from "@/lib/push";
import {
	removePushSubscription,
	savePushSubscription,
	updateNotificationPrefs,
} from "./actions";

export function NotificationsForm({
	emailOptin,
	pushOptin,
}: {
	emailOptin: boolean;
	pushOptin: boolean;
}) {
	const [email, setEmail] = useState(emailOptin);
	const [push, setPush] = useState(pushOptin);
	const [savingEmail, setSavingEmail] = useState(false);
	const [togglingPush, setTogglingPush] = useState(false);
	const [pushSupported, setPushSupported] = useState(true);
	const [permission, setPermission] = useState<
		NotificationPermission | "unsupported" | null
	>(null);

	useEffect(() => {
		setPushSupported(isPushSupported());
		setPermission(getPushPermission());
	}, []);

	const saveEmail = async () => {
		setSavingEmail(true);
		const result = await updateNotificationPrefs({ email_optin: email });
		setSavingEmail(false);
		if (!result.ok) {
			toast.error(result.error);
			return;
		}
		toast.success("Email preferences saved");
	};

	const togglePush = async (next: boolean) => {
		setTogglingPush(true);
		if (next) {
			const sub = await subscribeToPush();
			if (!sub.ok) {
				toast.error(sub.error);
				setTogglingPush(false);
				return;
			}
			// Required-by-W3C-types `endpoint` is optional on JSON but always present in practice.
			if (!sub.subscription.endpoint) {
				toast.error("Push subscription returned no endpoint");
				setTogglingPush(false);
				return;
			}
			const saved = await savePushSubscription({
				endpoint: sub.subscription.endpoint,
				keys: sub.subscription.keys,
				expirationTime: sub.subscription.expirationTime ?? null,
			});
			if (!saved.ok) {
				toast.error(saved.error);
				setTogglingPush(false);
				return;
			}
			setPush(true);
			setPermission("granted");
			toast.success("Push notifications enabled on this device");
		} else {
			const result = await unsubscribeFromPush();
			if (!result.ok) {
				toast.error(result.error);
				setTogglingPush(false);
				return;
			}
			await removePushSubscription(result.endpoint);
			setPush(false);
			toast.success("Push notifications disabled on this device");
		}
		setTogglingPush(false);
	};

	const pushDisabled =
		!pushSupported || togglingPush || permission === "denied";

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Email notifications</CardTitle>
					<CardDescription>
						We only email you about events that affect you directly.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between gap-3">
						<div className="space-y-0.5">
							<Label htmlFor="email">Email me when…</Label>
							<p className="text-xs text-muted-foreground">
								I'm outbid · An auction I bid on closes
							</p>
						</div>
						<Switch id="email" checked={email} onCheckedChange={setEmail} />
					</div>
					<Button
						onClick={saveEmail}
						disabled={savingEmail || email === emailOptin}
						className="w-full"
					>
						{savingEmail ? "Saving…" : "Save email preference"}
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Browser push</CardTitle>
					<CardDescription>
						Instant alerts even when this tab is closed. Per-device setting —
						enable on each device separately.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between gap-3">
						<div className="space-y-0.5">
							<Label htmlFor="push">Push notifications on this device</Label>
							{!pushSupported && (
								<p className="text-xs text-destructive">
									Your browser doesn't support push notifications.
								</p>
							)}
							{pushSupported && permission === "denied" && (
								<p className="text-xs text-destructive">
									Permission denied. Allow notifications for this site in your
									browser settings, then refresh.
								</p>
							)}
							{pushSupported && permission !== "denied" && (
								<p className="text-xs text-muted-foreground">
									You'll be asked for browser permission the first time.
								</p>
							)}
						</div>
						<Switch
							id="push"
							checked={push}
							onCheckedChange={togglePush}
							disabled={pushDisabled}
						/>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
