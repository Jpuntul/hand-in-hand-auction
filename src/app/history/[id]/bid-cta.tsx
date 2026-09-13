"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BidDialog } from "@/app/bidding/bid-dialog";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { isExpired, minNextBid } from "@/lib/auction";
import type { Item } from "@/lib/types";

export function BidCta({
	item,
	userId,
	onSuccess,
}: {
	item: Item;
	userId: string | null;
	onSuccess?: () => void;
}) {
	const router = useRouter();
	const now = useNow();
	const [open, setOpen] = useState(false);

	const expired = isExpired(item, now);
	const isOpen = item.status === "open" && !expired;
	const canBid = !!userId && isOpen;
	const minBid = minNextBid(item);

	const handleSuccess = () => {
		router.refresh();
		onSuccess?.();
	};

	if (item.status === "closed" || expired) return null;

	return (
		<>
			<Button
				size="lg"
				className="w-full"
				disabled={!canBid}
				onClick={() => setOpen(true)}
			>
				{!userId
					? "Sign in to bid"
					: item.status !== "open"
						? "Auction not open yet"
						: "Place bid"}
			</Button>
			{open && (
				<BidDialog
					item={item}
					minBid={minBid}
					open={open}
					onOpenChange={setOpen}
					onSuccess={handleSuccess}
				/>
			)}
		</>
	);
}
