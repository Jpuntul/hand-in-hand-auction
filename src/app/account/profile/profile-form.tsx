"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "./actions";

export function ProfileForm({
	email,
	isAdmin,
	createdAt,
	displayName: initDisplay,
	phone: initPhone,
}: {
	email: string | null;
	isAdmin: boolean;
	createdAt: string;
	displayName: string;
	phone: string;
}) {
	const [displayName, setDisplayName] = useState(initDisplay);
	const [phone, setPhone] = useState(initPhone);
	const [saving, setSaving] = useState(false);

	const save = async () => {
		setSaving(true);
		const result = await updateProfile({
			display_name: displayName,
			phone,
		});
		setSaving(false);
		if (!result.ok) {
			toast.error(result.error);
			return;
		}
		toast.success("Profile saved");
	};

	const dirty = displayName !== initDisplay || phone !== initPhone;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between gap-2">
					<div>
						<CardTitle className="text-base">Account</CardTitle>
						<CardDescription>
							{email ?? "Anonymous account"} · joined{" "}
							{new Date(createdAt).toLocaleDateString()}
						</CardDescription>
					</div>
					<Badge variant={isAdmin ? "default" : "secondary"}>
						{isAdmin ? "Admin" : "Bidder"}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="display_name">Display name</Label>
					<Input
						id="display_name"
						value={displayName}
						onChange={(e) => setDisplayName(e.target.value)}
						maxLength={100}
						placeholder="How you appear in bid history"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="phone">Phone (optional)</Label>
					<Input
						id="phone"
						type="tel"
						value={phone}
						onChange={(e) => setPhone(e.target.value)}
						placeholder="For pickup or payment coordination"
					/>
				</div>
				<Button onClick={save} disabled={saving || !dirty} className="w-full">
					{saving ? "Saving…" : "Save changes"}
				</Button>
			</CardContent>
		</Card>
	);
}
