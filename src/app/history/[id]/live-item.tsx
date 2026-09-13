"use client";

import { Gavel, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { formatUsd, minNextBid } from "@/lib/auction";
import { createClient } from "@/lib/supabase/client";
import type { Item } from "@/lib/types";
import { BidCta } from "./bid-cta";

export function PricePanel({
	item,
	userId,
	topBidder,
	uniqueBidders,
}: {
	item: Item;
	userId: string | null;
	topBidder: string | null;
	uniqueBidders: number;
}) {
	const minBid = minNextBid(item);

	return (
		<div className="rounded-2xl border border-[#DAA520]/30 bg-card shadow-xl shadow-[#DAA520]/5 p-6 space-y-5">
			{/* Current price */}
			<div className="space-y-1 text-center border-b border-border/50 pb-5">
				<p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
					{item.current_bid != null ? "Current bid" : "Starting bid"}
				</p>
				<p className="font-heading text-5xl font-bold text-[#DAA520] leading-none">
					{formatUsd(item.current_bid ?? item.starting_bid)}
				</p>
				{item.current_bid != null && (
					<p className="text-xs text-muted-foreground">
						Next minimum:{" "}
						<span className="font-medium text-foreground">
							{formatUsd(minBid)}
						</span>
					</p>
				)}
			</div>

			{/* Stats */}
			<div className="grid grid-cols-2 gap-3">
				<div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
					<Gavel className="h-4 w-4 text-[#DAA520]" />
					<div>
						<p className="text-lg font-bold leading-none">{item.bid_count}</p>
						<p className="text-[10px] uppercase tracking-wider text-muted-foreground">
							Bids
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
					<Users className="h-4 w-4 text-[#DAA520]" />
					<div>
						<p className="text-lg font-bold leading-none">{uniqueBidders}</p>
						<p className="text-[10px] uppercase tracking-wider text-muted-foreground">
							Bidders
						</p>
					</div>
				</div>
			</div>

			{/* Leading bidder */}
			{topBidder && item.status !== "closed" && (
				<div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
					<span className="text-muted-foreground">Leading: </span>
					<span className="font-semibold">{topBidder}</span>
				</div>
			)}

			{/* Winner */}
			{item.status === "closed" && item.winner_user_id && (
				<div className="rounded-lg border border-[#DAA520]/40 bg-[#DAA520]/10 p-3 text-center space-y-1">
					<Trophy className="mx-auto h-5 w-5 text-[#DAA520]" />
					<p className="font-semibold text-sm text-[#DAA520]">
						Won by {topBidder ?? "a bidder"}
					</p>
					<p className="text-xs text-muted-foreground">
						Final price:{" "}
						<span className="font-medium">{formatUsd(item.winning_bid)}</span>
					</p>
				</div>
			)}

			{/* CTA */}
			<BidCta item={item} userId={userId} />

			{!userId && item.status === "open" && (
				<p className="text-center text-xs text-muted-foreground">
					<Link href="/login" className="underline hover:text-foreground">
						Sign in
					</Link>{" "}
					to participate in this auction
				</p>
			)}
		</div>
	);
}

export function LiveItem({
	initialItem,
	userId,
	topBidder,
	uniqueBidders,
}: {
	initialItem: Item;
	userId: string | null;
	topBidder: string | null;
	uniqueBidders: number;
}) {
	const [item, setItem] = useState<Item>(initialItem);

	useEffect(() => {
		setItem(initialItem);
	}, [initialItem]);

	useEffect(() => {
		const supabase = createClient();
		const channel = supabase
			.channel(`item-live-${initialItem.id}`)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "items",
					filter: `id=eq.${initialItem.id}`,
				},
				(payload) => {
					setItem(payload.new as Item);
				},
			)
			.subscribe();

		return () => {
			void supabase.removeChannel(channel);
		};
	}, [initialItem.id]);

	return (
		<PricePanel
			item={item}
			userId={userId}
			topBidder={topBidder}
			uniqueBidders={uniqueBidders}
		/>
	);
}
