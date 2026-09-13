import Link from "next/link";
import { redirect } from "next/navigation";

import { ItemsGrid } from "@/app/bidding/items-grid";
import { SiteShell } from "@/components/site-shell";
import { buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/queries";
import { createClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";

export default async function WatchlistPage() {
	const [user, profile] = await Promise.all([
		getCurrentUser(),
		getCurrentProfile(),
	]);
	if (!user) redirect("/login");

	const supabase = await createClient();
	const { data: rows } = await supabase
		.from("watchlist")
		.select("item:items(*)")
		.eq("user_id", user.id);

	const items: Item[] = ((rows ?? []) as Array<{ item: Item | null }>)
		.map((r) => r.item)
		.filter((it): it is Item => it != null);
	const watchedIds = items.map((it) => it.id);

	return (
		<SiteShell
			size="wide"
			user={{
				email: user.email ?? null,
				displayName: profile?.display_name ?? null,
				isAdmin: profile?.is_admin ?? false,
			}}
		>
			<div className="space-y-6 sm:space-y-8">
				<section className="space-y-1">
					<h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
						Watchlist
					</h1>
					<p className="text-sm text-muted-foreground">
						{items.length} item{items.length === 1 ? "" : "s"} starred
					</p>
				</section>

				{items.length === 0 ? (
					<Card>
						<CardHeader>
							<CardTitle>Nothing here yet</CardTitle>
							<CardDescription>
								Star items from the auction to track them here.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Link href="/bidding" className={buttonVariants({ size: "sm" })}>
								Browse auction
							</Link>
						</CardContent>
					</Card>
				) : (
					<ItemsGrid
						initialItems={items}
						userId={user.id}
						watchedItemIds={watchedIds}
						mode="watchlist"
					/>
				)}
			</div>
		</SiteShell>
	);
}
