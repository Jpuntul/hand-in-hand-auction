import type { Item, ItemStatus } from "@/lib/types";

const usdNoCents = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
});

const usdWithCents = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

/**
 * Formats a monetary value in USD.
 * Uses 2 decimal places when cents exist, otherwise 0 decimal places.
 */
export function formatUsd(n: number | string | null | undefined): string {
	if (n == null) return "—";
	const num = typeof n === "number" ? n : Number(n);
	if (Number.isNaN(num)) return "—";
	return num % 1 !== 0 ? usdWithCents.format(num) : usdNoCents.format(num);
}

/**
 * Calculates the minimum next allowable bid for an item.
 */
export function minNextBid(
	item: Pick<Item, "current_bid" | "bid_increment" | "starting_bid">,
): number {
	return item.current_bid != null
		? Number(item.current_bid) + Number(item.bid_increment)
		: Number(item.starting_bid);
}

/**
 * Determines whether an item has passed its end_time relative to now.
 */
export function isExpired(item: Pick<Item, "end_time">, now: number): boolean {
	return item.end_time != null && new Date(item.end_time).getTime() <= now;
}

/**
 * Badge variant mapping for item statuses.
 * Includes "paused" for compatibility with workstream B's status additions.
 */
export const STATUS_VARIANT: Record<
	ItemStatus | "paused",
	"default" | "secondary" | "outline" | "destructive"
> = {
	scheduled: "secondary",
	open: "default",
	closed: "outline",
	cancelled: "destructive",
	paused: "secondary",
};
