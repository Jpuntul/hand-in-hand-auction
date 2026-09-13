"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { ImageUpload } from "@/components/admin/image-upload";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Item } from "@/lib/types";
import {
	createItem,
	deleteItem,
	updateItem,
	updateItemSchedule,
} from "./actions";
import {
	clientItemCreateSchema,
	clientItemDetailsSchema,
	clientItemScheduleSchema,
	defaultItemValues,
	ITEM_CATEGORIES,
	type ItemDetailsFormValues,
	type ItemFormValues,
	type ItemScheduleFormValues,
	SCHEDULE_STATUSES,
} from "./schema";

const NONE = "__none__";

/**
 * Emits YYYY-MM-DDTHH:mm:ss in the local time zone, preserving seconds for datetime-local inputs.
 */
export function toDatetimeLocal(iso: string | null): string {
	if (!iso) return "";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type DetailsFormRaw = {
	item_no: string;
	name: string;
	description: string;
	sponsor: string;
	categories: string;
	retail_value: string;
	starting_bid: string;
	bid_increment: string;
	image_urls: string[];
};

type ScheduleFormRaw = {
	start_time: string;
	end_time: string;
	status: (typeof SCHEDULE_STATUSES)[number] | Item["status"];
};

type CreateFormRaw = DetailsFormRaw & ScheduleFormRaw;

/**
 * Edit form for item details (lifecycle columns excluded).
 * Sends only dirty fields that differ from the loaded item.
 */
function ItemDetailsForm({ item }: { item: Item }) {
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);

	const defaultValues: DetailsFormRaw = {
		item_no: item.item_no?.toString() ?? "",
		name: item.name,
		description: item.description ?? "",
		sponsor: item.sponsor ?? "",
		categories: item.categories ?? NONE,
		retail_value: item.retail_value?.toString() ?? "",
		starting_bid: String(item.starting_bid),
		bid_increment: String(item.bid_increment),
		image_urls: item.image_urls ?? [],
	};

	const {
		register,
		handleSubmit,
		control,
		formState: { errors, dirtyFields },
	} = useForm({
		resolver: zodResolver(clientItemDetailsSchema),
		defaultValues,
	});

	const onSubmit = async (data: Record<string, unknown>) => {
		setSubmitting(true);
		const dirtyKeys = Object.keys(
			dirtyFields,
		) as (keyof typeof defaultValues)[];

		if (dirtyKeys.length === 0) {
			setSubmitting(false);
			toast.info("No changes to save");
			return;
		}

		const diff: Record<string, unknown> = {};
		for (const key of dirtyKeys) {
			if (dirtyFields[key]) {
				diff[key] = data[key];
			}
		}

		const result = await updateItem(
			item.id,
			diff as Partial<ItemDetailsFormValues>,
		);
		setSubmitting(false);

		if (!result.ok) {
			toast.error(result.error);
			return;
		}
		toast.success("Item details updated");
		router.push("/admin/items");
		router.refresh();
	};

	const onDelete = async () => {
		if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
		setSubmitting(true);
		const result = await deleteItem(item.id);
		setSubmitting(false);
		if (!result.ok) {
			toast.error(result.error ?? "Delete failed");
			return;
		}
		toast.success("Item deleted");
		router.push("/admin/items");
		router.refresh();
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Edit item details</CardTitle>
					<CardDescription>
						Update catalog details. Schedule and lifecycle actions are managed
						separately below.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="name">
								Name <span className="text-destructive">*</span>
							</Label>
							<Input id="name" {...register("name")} />
							{errors.name && (
								<p className="text-sm text-destructive">
									{errors.name.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="item_no">Item number</Label>
							<Input id="item_no" type="number" {...register("item_no")} />
							{errors.item_no && (
								<p className="text-sm text-destructive">
									{errors.item_no.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="sponsor">Sponsor</Label>
							<Input id="sponsor" {...register("sponsor")} />
							{errors.sponsor && (
								<p className="text-sm text-destructive">
									{errors.sponsor.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="description">Description</Label>
							<Textarea
								id="description"
								rows={3}
								{...register("description")}
							/>
							{errors.description && (
								<p className="text-sm text-destructive">
									{errors.description.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="categories">Category</Label>
							<Controller
								control={control}
								name="categories"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger id="categories" className="w-full">
											<SelectValue placeholder="No category" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE}>No category</SelectItem>
											{ITEM_CATEGORIES.map((c) => (
												<SelectItem key={c} value={c} className="capitalize">
													{c}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
							{errors.categories && (
								<p className="text-sm text-destructive">
									{errors.categories.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="retail_value">Retail value (USD)</Label>
							<Input
								id="retail_value"
								type="number"
								step="0.01"
								{...register("retail_value")}
							/>
							{errors.retail_value && (
								<p className="text-sm text-destructive">
									{errors.retail_value.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="starting_bid">
								Starting bid (USD) <span className="text-destructive">*</span>
							</Label>
							<Input
								id="starting_bid"
								type="number"
								step="0.01"
								{...register("starting_bid")}
							/>
							{errors.starting_bid && (
								<p className="text-sm text-destructive">
									{errors.starting_bid.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="bid_increment">
								Bid increment (USD) <span className="text-destructive">*</span>
							</Label>
							<Input
								id="bid_increment"
								type="number"
								step="0.01"
								{...register("bid_increment")}
							/>
							{errors.bid_increment && (
								<p className="text-sm text-destructive">
									{errors.bid_increment.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2 sm:col-span-2">
							<Label>Images</Label>
							<Controller
								control={control}
								name="image_urls"
								render={({ field }) => (
									<ImageUpload
										value={field.value ?? []}
										onChange={field.onChange}
										max={3}
									/>
								)}
							/>
							{errors.image_urls && (
								<p className="text-sm text-destructive">
									{errors.image_urls.message as string}
								</p>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			<div className="flex justify-between gap-3">
				<Button
					type="button"
					variant="destructive"
					onClick={onDelete}
					disabled={submitting}
				>
					Delete
				</Button>
				<div className="flex gap-3">
					<Button
						type="button"
						variant="outline"
						onClick={() => router.push("/admin/items")}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={submitting}>
						{submitting ? "Saving…" : "Save changes"}
					</Button>
				</div>
			</div>
		</form>
	);
}

/**
 * Dedicated Schedule card for editing an item's status, start_time, and end_time.
 */
export function ItemScheduleForm({ item }: { item: Item }) {
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);
	const [timeZone, setTimeZone] = useState<string>("UTC");

	useEffect(() => {
		try {
			setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
		} catch {
			// fallback to default
		}
	}, []);

	const isClosedOrCancelled =
		item.status === "closed" || item.status === "cancelled";
	const isOpen = item.status === "open";

	const {
		register,
		handleSubmit,
		control,
		formState: { errors },
	} = useForm({
		resolver: zodResolver(clientItemScheduleSchema),
		defaultValues: {
			start_time: toDatetimeLocal(item.start_time),
			end_time: toDatetimeLocal(item.end_time),
			status: item.status,
		},
	});

	const onSubmit = async (data: Record<string, unknown>) => {
		setSubmitting(true);
		const values: ItemScheduleFormValues = {
			status: data.status as ItemScheduleFormValues["status"],
			start_time: data.start_time
				? new Date(String(data.start_time)).toISOString()
				: null,
			end_time: data.end_time
				? new Date(String(data.end_time)).toISOString()
				: null,
		};
		const result = await updateItemSchedule(item.id, values);
		setSubmitting(false);

		if (!result.ok) {
			toast.error(result.error);
			return;
		}
		toast.success("Schedule updated");
		router.refresh();
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Schedule</CardTitle>
					<CardDescription>
						Manage auction status and bidding window.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{isClosedOrCancelled ? (
						<div className="rounded-lg border border-muted bg-muted/30 p-4 text-sm">
							<p className="font-medium">
								Item is currently{" "}
								<span className="font-semibold capitalize text-foreground">
									{item.status}
								</span>
								.
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Status changes for closed or cancelled items are managed via the
								Admin overrides below.
							</p>
						</div>
					) : (
						<>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2 sm:col-span-2">
									<Label htmlFor="sched_status">Status</Label>
									<Controller
										control={control}
										name="status"
										render={({ field }) => (
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<SelectTrigger id="sched_status" className="w-full">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{SCHEDULE_STATUSES.map((s) => (
														<SelectItem
															key={s}
															value={s}
															className="capitalize"
														>
															{s}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									/>
									{errors.status && (
										<p className="text-sm text-destructive">
											{errors.status.message as string}
										</p>
									)}
								</div>

								<div className="space-y-2">
									<Label htmlFor="sched_start_time">
										Start time{" "}
										{isOpen && (
											<span className="text-xs text-muted-foreground">
												(read-only while open)
											</span>
										)}
									</Label>
									<Input
										id="sched_start_time"
										type="datetime-local"
										step="1"
										readOnly={isOpen}
										disabled={isOpen}
										{...register("start_time")}
									/>
									{errors.start_time && (
										<p className="text-sm text-destructive">
											{errors.start_time.message as string}
										</p>
									)}
								</div>

								<div className="space-y-2">
									<Label htmlFor="sched_end_time">End time</Label>
									<Input
										id="sched_end_time"
										type="datetime-local"
										step="1"
										{...register("end_time")}
									/>
									{errors.end_time && (
										<p className="text-sm text-destructive">
											{errors.end_time.message as string}
										</p>
									)}
								</div>
							</div>

							<p className="text-xs text-muted-foreground">
								Times are entered in your browser's time zone ({timeZone}).
							</p>

							<div className="flex justify-end pt-2">
								<Button type="submit" disabled={submitting}>
									{submitting ? "Saving schedule…" : "Save schedule"}
								</Button>
							</div>
						</>
					)}
				</CardContent>
			</Card>
		</form>
	);
}

/**
 * Creation form for new items (details + initial schedule merged).
 */
function ItemCreateForm() {
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);
	const [timeZone, setTimeZone] = useState<string>("UTC");

	useEffect(() => {
		try {
			setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
		} catch {
			// fallback to default
		}
	}, []);

	const defaultValues: CreateFormRaw = {
		item_no: "",
		name: "",
		description: "",
		sponsor: "",
		categories: NONE,
		retail_value: "",
		starting_bid: String(defaultItemValues.starting_bid),
		bid_increment: String(defaultItemValues.bid_increment),
		start_time: "",
		end_time: "",
		status: "scheduled",
		image_urls: [],
	};

	const {
		register,
		handleSubmit,
		control,
		formState: { errors },
	} = useForm({
		resolver: zodResolver(clientItemCreateSchema),
		defaultValues,
	});

	const onSubmit = async (data: Record<string, unknown>) => {
		setSubmitting(true);
		const values: ItemFormValues = {
			name: String(data.name ?? ""),
			item_no: (data.item_no as number | null) ?? null,
			description: (data.description as string | null) ?? null,
			sponsor: (data.sponsor as string | null) ?? null,
			categories: (data.categories as ItemFormValues["categories"]) ?? null,
			retail_value: (data.retail_value as number | null) ?? null,
			starting_bid: Number(data.starting_bid),
			bid_increment: Number(data.bid_increment),
			image_urls: (data.image_urls as string[]) ?? [],
			status: data.status as ItemFormValues["status"],
			start_time: data.start_time
				? new Date(String(data.start_time)).toISOString()
				: null,
			end_time: data.end_time
				? new Date(String(data.end_time)).toISOString()
				: null,
		};

		const result = await createItem(values);
		setSubmitting(false);

		if (!result.ok) {
			toast.error(result.error);
			return;
		}
		toast.success("Item created");
		router.push("/admin/items");
		router.refresh();
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>New item</CardTitle>
					<CardDescription>
						Enter the item details and initial schedule.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="name">
								Name <span className="text-destructive">*</span>
							</Label>
							<Input id="name" {...register("name")} />
							{errors.name && (
								<p className="text-sm text-destructive">
									{errors.name.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="item_no">Item number</Label>
							<Input id="item_no" type="number" {...register("item_no")} />
							{errors.item_no && (
								<p className="text-sm text-destructive">
									{errors.item_no.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="sponsor">Sponsor</Label>
							<Input id="sponsor" {...register("sponsor")} />
							{errors.sponsor && (
								<p className="text-sm text-destructive">
									{errors.sponsor.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="description">Description</Label>
							<Textarea
								id="description"
								rows={3}
								{...register("description")}
							/>
							{errors.description && (
								<p className="text-sm text-destructive">
									{errors.description.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="categories">Category</Label>
							<Controller
								control={control}
								name="categories"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger id="categories" className="w-full">
											<SelectValue placeholder="No category" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE}>No category</SelectItem>
											{ITEM_CATEGORIES.map((c) => (
												<SelectItem key={c} value={c} className="capitalize">
													{c}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
							{errors.categories && (
								<p className="text-sm text-destructive">
									{errors.categories.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="retail_value">Retail value (USD)</Label>
							<Input
								id="retail_value"
								type="number"
								step="0.01"
								{...register("retail_value")}
							/>
							{errors.retail_value && (
								<p className="text-sm text-destructive">
									{errors.retail_value.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="starting_bid">
								Starting bid (USD) <span className="text-destructive">*</span>
							</Label>
							<Input
								id="starting_bid"
								type="number"
								step="0.01"
								{...register("starting_bid")}
							/>
							{errors.starting_bid && (
								<p className="text-sm text-destructive">
									{errors.starting_bid.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="bid_increment">
								Bid increment (USD) <span className="text-destructive">*</span>
							</Label>
							<Input
								id="bid_increment"
								type="number"
								step="0.01"
								{...register("bid_increment")}
							/>
							{errors.bid_increment && (
								<p className="text-sm text-destructive">
									{errors.bid_increment.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2 sm:col-span-2">
							<Label>Images</Label>
							<Controller
								control={control}
								name="image_urls"
								render={({ field }) => (
									<ImageUpload
										value={field.value ?? []}
										onChange={field.onChange}
										max={3}
									/>
								)}
							/>
							{errors.image_urls && (
								<p className="text-sm text-destructive">
									{errors.image_urls.message as string}
								</p>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Schedule</CardTitle>
					<CardDescription>
						Set the initial status and schedule for the item.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="create_status">Status</Label>
							<Controller
								control={control}
								name="status"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger id="create_status" className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{SCHEDULE_STATUSES.map((s) => (
												<SelectItem key={s} value={s} className="capitalize">
													{s}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
							{errors.status && (
								<p className="text-sm text-destructive">
									{errors.status.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="create_start_time">Start time</Label>
							<Input
								id="create_start_time"
								type="datetime-local"
								step="1"
								{...register("start_time")}
							/>
							{errors.start_time && (
								<p className="text-sm text-destructive">
									{errors.start_time.message as string}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="create_end_time">End time</Label>
							<Input
								id="create_end_time"
								type="datetime-local"
								step="1"
								{...register("end_time")}
							/>
							{errors.end_time && (
								<p className="text-sm text-destructive">
									{errors.end_time.message as string}
								</p>
							)}
						</div>
					</div>

					<p className="text-xs text-muted-foreground">
						Times are entered in your browser's time zone ({timeZone}).
					</p>
				</CardContent>
			</Card>

			<div className="flex justify-end gap-3">
				<Button
					type="button"
					variant="outline"
					onClick={() => router.push("/admin/items")}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={submitting}>
					{submitting ? "Creating…" : "Create item"}
				</Button>
			</div>
		</form>
	);
}

/**
 * Main ItemForm entry point.
 * In edit mode, renders ItemDetailsForm (Schedule is rendered in ItemScheduleForm).
 * In create mode, renders ItemCreateForm with both details and initial schedule.
 */
export function ItemForm({ item }: { item?: Item | null }) {
	if (item) {
		return <ItemDetailsForm item={item} />;
	}
	return <ItemCreateForm />;
}
