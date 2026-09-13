import { ChevronLeft, Gavel, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatUsd, STATUS_VARIANT } from "@/lib/auction";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/queries";
import { createClient } from "@/lib/supabase/server";
import { ImageGallery } from "./image-gallery";
import { LiveItem } from "./live-item";

export default async function ItemDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const [supabase, user, profile] = await Promise.all([
		createClient(),
		getCurrentUser(),
		getCurrentProfile(),
	]);

	const [{ data: item }, { data: bids }] = await Promise.all([
		supabase.from("items").select("*").eq("id", id).maybeSingle(),
		supabase
			.from("bid_history")
			.select(
				"id, amount, user_id, created_at, extended_end_time, cancelled_at, cancel_reason, bidder:public_profiles!user_id(display_name)",
			)
			.eq("item_id", id)
			.order("id", { ascending: false }),
	]);

	if (!item) notFound();

	const rows = bids ?? [];
	const liveRows = rows.filter((b) => b.cancelled_at == null);
	const uniqueBidders = new Set(liveRows.map((b) => b.user_id)).size;
	const topBidder = liveRows[0]?.bidder?.display_name ?? null;

	return (
		<SiteShell
			size="wide"
			user={
				user
					? {
							email: user.email ?? null,
							displayName: profile?.display_name ?? null,
							isAdmin: profile?.is_admin ?? false,
						}
					: null
			}
		>
			<div className="space-y-8">
				{/* ── Back nav ───────────────────────────────── */}
				<Link
					href="/bidding"
					className={buttonVariants({ variant: "ghost", size: "sm" })}
				>
					<ChevronLeft className="mr-1 h-4 w-4" />
					Back to auction
				</Link>

				{/* ── Hero image ─────────────────────────────── */}
				{item.image_urls.length > 0 && (
					<ImageGallery urls={item.image_urls} name={item.name} />
				)}

				{/* ── Title block ────────────────────────────── */}
				<div className="space-y-3 text-center">
					{item.categories && (
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DAA520]">
							{item.categories}
						</p>
					)}
					<h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
						{item.name}
					</h1>
					{item.sponsor && (
						<p className="text-muted-foreground">
							Graciously donated by{" "}
							<span className="font-medium">{item.sponsor}</span>
						</p>
					)}
					<div className="flex items-center justify-center gap-3">
						<Badge variant={STATUS_VARIANT[item.status]} className="capitalize">
							{item.status === "open"
								? "Open for bids"
								: item.status === "closed"
									? "Auction closed"
									: item.status}
						</Badge>
						{item.item_no && (
							<span className="text-xs text-muted-foreground">
								Lot #{item.item_no}
							</span>
						)}
					</div>
				</div>

				{/* ── Gold divider ────────────────────────────── */}
				<div className="flex items-center gap-4">
					<div className="h-px flex-1 bg-[#DAA520]/30" />
					<Gavel className="h-5 w-5 text-[#DAA520]/60" />
					<div className="h-px flex-1 bg-[#DAA520]/30" />
				</div>

				{/* ── Main body: description + bid panel ─────── */}
				<div className="grid gap-8 lg:grid-cols-5">
					{/* Left — description + item details */}
					<div className="space-y-6 lg:col-span-3">
						{item.description && (
							<div className="space-y-2">
								<h2 className="text-sm font-semibold uppercase tracking-widest">
									About this item
								</h2>
								<p className="leading-relaxed text-muted-foreground whitespace-pre-line">
									{item.description}
								</p>
							</div>
						)}

						<div className="space-y-2">
							<h2 className="text-sm font-semibold uppercase tracking-widest">
								Auction details
							</h2>
							<dl className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card/80 text-sm">
								{item.retail_value && (
									<div className="flex justify-between px-4 py-3">
										<dt className="text-muted-foreground">Estimated value</dt>
										<dd className="font-semibold text-[#DAA520]">
											{formatUsd(item.retail_value)}
										</dd>
									</div>
								)}
								<div className="flex justify-between px-4 py-3">
									<dt className="text-muted-foreground">Starting bid</dt>
									<dd className="font-medium">
										{formatUsd(item.starting_bid)}
									</dd>
								</div>
								<div className="flex justify-between px-4 py-3">
									<dt className="text-muted-foreground">Bid increment</dt>
									<dd className="font-medium">
										{formatUsd(item.bid_increment)}
									</dd>
								</div>
								{item.start_time && (
									<div className="flex justify-between px-4 py-3">
										<dt className="text-muted-foreground">Opens</dt>
										<dd className="font-medium">
											{new Date(item.start_time).toLocaleString()}
										</dd>
									</div>
								)}
								{item.end_time && (
									<div className="flex justify-between px-4 py-3">
										<dt className="text-muted-foreground">
											{item.status === "closed" ? "Closed" : "Closes"}
										</dt>
										<dd className="font-medium">
											{new Date(item.end_time).toLocaleString()}
										</dd>
									</div>
								)}
							</dl>
						</div>
					</div>

					{/* Right — sticky bid panel */}
					<div className="lg:col-span-2">
						<div className="lg:sticky lg:top-24 space-y-4">
							<LiveItem
								initialItem={item}
								userId={user?.id ?? null}
								topBidder={topBidder}
								uniqueBidders={uniqueBidders}
							/>
						</div>
					</div>
				</div>

				{/* ── Gold divider ────────────────────────────── */}
				<div className="flex items-center gap-4">
					<div className="h-px flex-1 bg-[#DAA520]/30" />
					<span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#DAA520]/60">
						Bid History
					</span>
					<div className="h-px flex-1 bg-[#DAA520]/30" />
				</div>

				{/* ── Bid history table ───────────────────────── */}
				{rows.length === 0 ? (
					<p className="py-8 text-center text-sm text-muted-foreground">
						No bids yet — be the first to bid on this item.
					</p>
				) : (
					<div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
						<Table>
							<TableHeader>
								<TableRow className="border-b border-[#DAA520]/20 bg-[#122c7a]/5">
									<TableHead className="text-[10px] uppercase tracking-wider">
										Rank
									</TableHead>
									<TableHead className="text-[10px] uppercase tracking-wider">
										Bidder
									</TableHead>
									<TableHead className="text-[10px] uppercase tracking-wider">
										Amount
									</TableHead>
									<TableHead className="hidden text-[10px] uppercase tracking-wider sm:table-cell">
										Time
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((b, i) => {
									const isCancelled = b.cancelled_at != null;
									const isTop = !isCancelled && b.id === liveRows[0]?.id;
									return (
										<TableRow
											key={b.id}
											className={
												isTop
													? "bg-[#DAA520]/8 border-b border-[#DAA520]/15"
													: isCancelled
														? "border-b border-border/40 opacity-60"
														: "border-b border-border/40"
											}
										>
											<TableCell className="py-3">
												{isTop ? (
													<Trophy className="h-4 w-4 text-[#DAA520]" />
												) : (
													<span className="text-xs text-muted-foreground">
														{rows.length - i}
													</span>
												)}
											</TableCell>
											<TableCell className="py-3">
												<span
													className={
														isTop
															? "font-semibold text-[#DAA520]"
															: isCancelled
																? "text-sm text-muted-foreground line-through"
																: "text-sm"
													}
												>
													{b.bidder?.display_name ?? "Bidder"}
												</span>
											</TableCell>
											<TableCell className="py-3 font-mono">
												<span
													className={
														isTop
															? "font-bold text-[#DAA520]"
															: isCancelled
																? "text-sm text-muted-foreground line-through"
																: "text-sm"
													}
												>
													{formatUsd(b.amount)}
												</span>
												{isCancelled && (
													<Badge
														variant="destructive"
														className="ml-2 px-1.5 py-0 text-[10px]"
													>
														Cancelled
													</Badge>
												)}
												{b.extended_end_time && !isCancelled && (
													<span className="ml-2 rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-700">
														+60s
													</span>
												)}
											</TableCell>
											<TableCell className="hidden py-3 text-xs text-muted-foreground sm:table-cell">
												{new Date(b.created_at).toLocaleString()}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}
			</div>
		</SiteShell>
	);
}
