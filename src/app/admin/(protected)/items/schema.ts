import { z } from "zod";

import { ITEM_CATEGORIES, ITEM_STATUSES, type ItemStatus } from "@/lib/types";

export { ITEM_CATEGORIES, ITEM_STATUSES };

export const SCHEDULE_STATUSES = [
	"scheduled",
	"open",
	"paused",
] as const satisfies readonly ItemStatus[];

// Helper coercions / preprocessors for empty strings from HTML inputs
const emptyToNull = (v: unknown) =>
	v === "" || v === undefined || v === null ? null : v;
const emptyToUndefined = (v: unknown) =>
	v === "" || v === null ? undefined : v;

// ==========================================
// 1. Details Schema (Server-side validation)
// ==========================================
export const itemDetailsSchema = z.object({
	item_no: z.number().int().positive().nullable(),
	name: z.string().min(1, "Name is required").max(200),
	description: z.string().nullable(),
	sponsor: z.string().nullable(),
	categories: z.enum(ITEM_CATEGORIES).nullable(),
	retail_value: z.number().nonnegative().nullable(),
	starting_bid: z.number().positive("Starting bid must be positive"),
	bid_increment: z.number().positive("Bid increment must be positive"),
	image_urls: z.array(z.string()).default([]),
});

export type ItemDetailsFormValues = z.infer<typeof itemDetailsSchema>;

// ==========================================
// 2. Schedule Schema (Server-side validation)
// ==========================================
export const itemScheduleRawSchema = z.object({
	start_time: z.string().nullable(),
	end_time: z.string().nullable(),
	status: z.enum(ITEM_STATUSES),
});

export const itemScheduleSchema = itemScheduleRawSchema
	.refine((data) => data.status !== "closed" && data.status !== "cancelled", {
		message: "Status cannot be set to closed or cancelled directly",
		path: ["status"],
	})
	.refine(
		(data) => {
			if (data.status === "open") {
				return Boolean(data.end_time && data.end_time.trim() !== "");
			}
			return true;
		},
		{
			message: "End time is required when item is open",
			path: ["end_time"],
		},
	)
	.refine(
		(data) => {
			if (data.start_time && data.end_time) {
				return (
					new Date(data.end_time).getTime() >
					new Date(data.start_time).getTime()
				);
			}
			return true;
		},
		{
			message: "End time must be after start time",
			path: ["end_time"],
		},
	);

export type ItemScheduleFormValues = z.infer<typeof itemScheduleRawSchema>;

// ==========================================
// 3. Merged Schema (Used only by createItem)
// ==========================================
export const itemSchema = itemDetailsSchema
	.merge(itemScheduleRawSchema)
	.refine((data) => data.status !== "closed" && data.status !== "cancelled", {
		message: "Status cannot be closed or cancelled on create",
		path: ["status"],
	})
	.refine(
		(data) => {
			if (data.status === "open") {
				return Boolean(data.end_time && data.end_time.trim() !== "");
			}
			return true;
		},
		{
			message: "End time is required when item is open",
			path: ["end_time"],
		},
	)
	.refine(
		(data) => {
			if (data.start_time && data.end_time) {
				return (
					new Date(data.end_time).getTime() >
					new Date(data.start_time).getTime()
				);
			}
			return true;
		},
		{
			message: "End time must be after start time",
			path: ["end_time"],
		},
	);

export type ItemFormValues = z.infer<typeof itemDetailsSchema> &
	z.infer<typeof itemScheduleRawSchema>;

export const defaultItemValues: ItemFormValues = {
	item_no: null,
	name: "",
	description: null,
	sponsor: null,
	categories: null,
	retail_value: null,
	starting_bid: 100,
	bid_increment: 10,
	start_time: null,
	end_time: null,
	status: "scheduled",
	image_urls: [],
};

// ========================================================
// 4. Client-side Coercing Schemas (used with zodResolver)
// ========================================================

export const clientItemDetailsSchema = z.object({
	item_no: z.preprocess(
		emptyToNull,
		z.coerce
			.number({ message: "Item number must be a number" })
			.int("Item number must be an integer")
			.positive("Item number must be positive")
			.nullable(),
	),
	name: z.string().min(1, "Name is required").max(200),
	description: z.preprocess(emptyToNull, z.string().nullable()),
	sponsor: z.preprocess(emptyToNull, z.string().nullable()),
	categories: z.preprocess(
		(v) =>
			v === "__none__" || v === "" || v === null || v === undefined ? null : v,
		z.enum(ITEM_CATEGORIES).nullable(),
	),
	retail_value: z.preprocess(
		emptyToNull,
		z.coerce
			.number({ message: "Retail value must be a number" })
			.nonnegative("Retail value must be non-negative")
			.nullable(),
	),
	starting_bid: z.preprocess(
		emptyToUndefined,
		z.coerce
			.number({ message: "Starting bid is required" })
			.positive("Starting bid must be positive"),
	),
	bid_increment: z.preprocess(
		emptyToUndefined,
		z.coerce
			.number({ message: "Bid increment is required" })
			.positive("Bid increment must be positive"),
	),
	image_urls: z.array(z.string()).default([]),
});

export const clientItemScheduleSchema = z
	.object({
		start_time: z.preprocess(emptyToNull, z.string().nullable()),
		end_time: z.preprocess(emptyToNull, z.string().nullable()),
		status: z.enum(ITEM_STATUSES),
	})
	.refine((data) => data.status !== "closed" && data.status !== "cancelled", {
		message: "Status cannot be closed or cancelled directly",
		path: ["status"],
	})
	.refine(
		(data) => {
			if (data.status === "open") {
				return Boolean(data.end_time && data.end_time.trim() !== "");
			}
			return true;
		},
		{
			message: "End time is required when item is open",
			path: ["end_time"],
		},
	)
	.refine(
		(data) => {
			if (data.start_time && data.end_time) {
				return (
					new Date(data.end_time).getTime() >
					new Date(data.start_time).getTime()
				);
			}
			return true;
		},
		{
			message: "End time must be after start time",
			path: ["end_time"],
		},
	);

export const clientItemCreateSchema = clientItemDetailsSchema
	.merge(
		z.object({
			start_time: z.preprocess(emptyToNull, z.string().nullable()),
			end_time: z.preprocess(emptyToNull, z.string().nullable()),
			status: z.enum(ITEM_STATUSES),
		}),
	)
	.refine((data) => data.status !== "closed" && data.status !== "cancelled", {
		message: "Status cannot be closed or cancelled on create",
		path: ["status"],
	})
	.refine(
		(data) => {
			if (data.status === "open") {
				return Boolean(data.end_time && data.end_time.trim() !== "");
			}
			return true;
		},
		{
			message: "End time is required when item is open",
			path: ["end_time"],
		},
	)
	.refine(
		(data) => {
			if (data.start_time && data.end_time) {
				return (
					new Date(data.end_time).getTime() >
					new Date(data.start_time).getTime()
				);
			}
			return true;
		},
		{
			message: "End time must be after start time",
			path: ["end_time"],
		},
	);
