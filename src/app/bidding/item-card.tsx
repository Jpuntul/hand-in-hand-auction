"use client";

import Image from "next/image";
import Link from "next/link";
import { useContext, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { WatchlistStar } from "@/components/watchlist-star";
import { NowContext } from "@/hooks/use-now";
import { formatUsd, isExpired, minNextBid } from "@/lib/auction";
import type { Item } from "@/lib/types";
import { BidDialog } from "./bid-dialog";

function Countdown({ endTime, now }: { endTime: string; now: number }) {
	const remaining = Math.max(0, new Date(endTime).getTime() - now);
	if (remaining === 0) return <>Auction ended</>;

	const totalSec = Math.floor(remaining / 1000);
	const days = Math.floor(totalSec / 86400);
	const hours = Math.floor((totalSec % 86400) / 3600);
	const minutes = Math.floor((totalSec % 3600) / 60);
	const seconds = totalSec % 60;

	const label =
		days > 0
			? `${days}d ${hours}h`
			: hours > 0
				? `${hours}h ${minutes}m`
				: minutes > 0
					? `${minutes}m ${seconds}s`
					: `${seconds}s`;

	return (
		<span
			className={
				remaining < 60_000 ? "font-medium text-destructive" : undefined
			}
		>
			{label}
		</span>
	);
}

export function ItemCard({
	item,
	userId,
	getNow,
	isWatched = false,
}: {
	item: Item;
	userId: string | null;
	getNow?: () => number;
	isWatched?: boolean;
}) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const contextNow = useContext(NowContext);
	const now = contextNow ?? (getNow ? getNow() : Date.now());

	const minBid = minNextBid(item);
	const expired = isExpired(item, now);
	const isYourBid = userId != null && item.current_bidder_id === userId;
	const canBid = userId != null && item.status === "open" && !expired;
	const firstImage = item.image_urls?.[0];

	return (
		<Card className="relative flex flex-col overflow-hidden transition-shadow hover:shadow-lg">
			{firstImage && (
				<div className="relative aspect-video w-full bg-muted">
					<Image
						src={firstImage}
						alt={item.name}
						fill
						sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
						className="object-cover"
					/>
				</div>
			)}
			<CardHeader>
				<div className="flex items-start justify-between gap-2">
					<CardTitle className="text-base">
						<Link
							href={`/history/${item.id}`}
							className="after:absolute after:inset-0 focus:outline-none focus-visible:underline"
						>
							{item.name}
						</Link>
					</CardTitle>
					<div className="relative z-10 flex shrink-0 items-center gap-1">
						{item.categories && (
							<Badge variant="outline" className="capitalize">
								{item.categories}
							</Badge>
						)}
						{item.item_no != null && (
							<Badge variant="secondary">#{item.item_no}</Badge>
						)}
						{userId && <WatchlistStar itemId={item.id} initial={isWatched} />}
					</div>
				</div>
				{item.sponsor && (
					<CardDescription>donated by {item.sponsor}</CardDescription>
				)}
			</CardHeader>
			<CardContent className="flex-1 space-y-3">
				{item.description && (
					<p className="text-sm text-muted-foreground line-clamp-3">
						{item.description}
					</p>
				)}
				<div className="space-y-1 border-t pt-3">
					<div className="flex items-baseline justify-between">
						<span className="text-xs text-muted-foreground">
							{item.current_bid != null ? "Current bid" : "Starting bid"}
						</span>
						<span className="text-xl font-semibold">
							{formatUsd(item.current_bid ?? item.starting_bid)}
						</span>
					</div>
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span>
							{item.bid_count} bid{item.bid_count === 1 ? "" : "s"}
						</span>
						{isYourBid && (
							<Badge variant="default" className="h-4 px-1.5 text-[10px]">
								You're winning
							</Badge>
						)}
						<span>min next: {formatUsd(minBid)}</span>
					</div>
					{item.end_time && (
						<div className="text-xs text-muted-foreground">
							{expired ? (
								<>Auction ended</>
							) : (
								<>
									Ends in <Countdown endTime={item.end_time} now={now} />
								</>
							)}
						</div>
					)}
				</div>
			</CardContent>
			<CardFooter className="relative z-10">
				<Button
					className="w-full"
					disabled={!canBid}
					onClick={() => setDialogOpen(true)}
				>
					{!userId
						? "Sign in to bid"
						: expired
							? "Auction ended"
							: item.status !== "open"
								? "Not open yet"
								: isYourBid
									? "Raise your bid"
									: "Place bid"}
				</Button>
				{dialogOpen && (
					<BidDialog
						item={item}
						minBid={minBid}
						open={dialogOpen}
						onOpenChange={setDialogOpen}
					/>
				)}
			</CardFooter>
		</Card>
	);
}
