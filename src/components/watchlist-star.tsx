"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { toggleWatchlist } from "@/app/account/watchlist/actions";

export function WatchlistStar({
	itemId,
	initial,
}: {
	itemId: string;
	initial: boolean;
}) {
	const [starred, setStarred] = useState(initial);
	const [busy, setBusy] = useState(false);

	const click = async () => {
		if (busy) return;
		const next = !starred;
		setStarred(next); // optimistic
		setBusy(true);
		const result = await toggleWatchlist(itemId);
		setBusy(false);
		if (!result.ok) {
			setStarred(!next); // revert
			toast.error(result.error);
			return;
		}
		setStarred(result.watched);
	};

	return (
		<button
			type="button"
			onClick={click}
			aria-label={starred ? "Remove from watchlist" : "Add to watchlist"}
			className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
			disabled={busy}
		>
			<Star
				className={`h-4 w-4 ${starred ? "fill-amber-400 text-amber-500" : ""}`}
			/>
		</button>
	);
}
