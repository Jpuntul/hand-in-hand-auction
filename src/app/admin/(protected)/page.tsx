import {
	Activity,
	AlertTriangle,
	Gavel,
	Package2,
	TrendingUp,
	Users,
} from "lucide-react";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth/queries";
import { createClient } from "@/lib/supabase/server";

const usd = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
});

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
	const [supabase, profile] = await Promise.all([
		createClient(),
		getCurrentProfile(),
	]);

	const yesterday = new Date(Date.now() - 86_400_000).toISOString();
	const twoHoursFromNow = new Date(Date.now() + 7_200_000).toISOString();
	const now = new Date().toISOString();

	const [
		{ count: openItems },
		{ count: bidsToday },
		{ data: revenueData },
		{ count: closingSoon },
		{ data: topItems },
		{ count: totalUsers },
	] = await Promise.all([
		supabase
			.from("items")
			.select("*", { count: "exact", head: true })
			.eq("status", "open"),
		supabase
			.from("bid_history")
			.select("*", { count: "exact", head: true })
			.gte("created_at", yesterday),
		supabase.from("open_items_revenue").select("revenue").single(),
		supabase
			.from("items")
			.select("*", { count: "exact", head: true })
			.eq("status", "open")
			.lt("end_time", twoHoursFromNow)
			.gt("end_time", now),
		supabase
			.from("items")
			.select("id, name, bid_count, current_bid, status, end_time, categories")
			.in("status", ["open", "scheduled"])
			.order("bid_count", { ascending: false })
			.limit(5),
		supabase.from("profiles").select("*", { count: "exact", head: true }),
	]);

	const projectedRevenue = Number(revenueData?.revenue ?? 0);

	return (
		<AdminShell size="wide">
			<div className="space-y-8">
				{/* Header */}
				<div>
					<h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
						Dashboard
					</h1>
					<p className="text-muted-foreground">
						Welcome back, {profile?.display_name ?? "Admin"}.
					</p>
				</div>

				{/* Alert — items closing soon */}
				{(closingSoon ?? 0) > 0 && (
					<div className="flex items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
						<AlertTriangle className="h-5 w-5 text-amber-500" />
						<p className="text-sm font-medium">
							{closingSoon} item{closingSoon === 1 ? "" : "s"} closing in the
							next 2 hours.
						</p>
						<Link
							href="/admin/items"
							className="ml-auto text-xs font-medium underline"
						>
							Review
						</Link>
					</div>
				)}

				{/* Stat cards */}
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Open auctions
							</CardTitle>
							<Gavel className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-bold">{openItems ?? 0}</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Bids (last 24h)
							</CardTitle>
							<Activity className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-bold">{bidsToday ?? 0}</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Revenue at stake
							</CardTitle>
							<TrendingUp className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-bold">
								{usd.format(projectedRevenue)}
							</p>
							<p className="text-xs text-muted-foreground">
								current bids on open items
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Registered bidders
							</CardTitle>
							<Users className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<p className="text-3xl font-bold">{totalUsers ?? 0}</p>
						</CardContent>
					</Card>
				</div>

				{/* Quick nav + top items */}
				<div className="grid gap-6 lg:grid-cols-3">
					{/* Top contested items */}
					<div className="lg:col-span-2 space-y-3">
						<h2 className="text-sm font-semibold uppercase tracking-widest">
							Top items by activity
						</h2>
						<div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
							{!topItems?.length ? (
								<p className="px-4 py-6 text-sm text-muted-foreground">
									No active items.
								</p>
							) : (
								topItems.map((item) => (
									<Link
										key={item.id}
										href={`/admin/items/${item.id}/edit`}
										className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
									>
										<div className="min-w-0">
											<p className="truncate font-medium">{item.name}</p>
											{item.end_time && (
												<p className="text-xs text-muted-foreground">
													Closes {new Date(item.end_time).toLocaleString()}
												</p>
											)}
										</div>
										<div className="flex shrink-0 items-center gap-3">
											<Badge variant="secondary">
												{item.bid_count} bid{item.bid_count === 1 ? "" : "s"}
											</Badge>
											<span className="font-mono text-sm font-semibold text-[#DAA520]">
												{usd.format(Number(item.current_bid ?? 0))}
											</span>
										</div>
									</Link>
								))
							)}
						</div>
					</div>

					{/* Quick links */}
					<div className="space-y-3">
						<h2 className="text-sm font-semibold uppercase tracking-widest">
							Management
						</h2>
						<div className="space-y-2">
							{[
								{
									href: "/admin/items",
									icon: Package2,
									label: "Items",
									desc: "Create, schedule, edit",
								},
								{
									href: "/admin/users",
									icon: Users,
									label: "Users",
									desc: "Manage roles & accounts",
								},
								{
									href: "/admin/audit-log",
									icon: Activity,
									label: "Audit log",
									desc: "All admin actions",
								},
							].map(({ href, icon: Icon, label, desc }) => (
								<Link key={href} href={href}>
									<Card className="transition-colors hover:bg-muted/40">
										<CardContent className="flex items-center gap-3 py-3 px-4">
											<Icon className="h-5 w-5 text-primary" />
											<div>
												<p className="text-sm font-medium">{label}</p>
												<p className="text-xs text-muted-foreground">{desc}</p>
											</div>
										</CardContent>
									</Card>
								</Link>
							))}
						</div>
					</div>
				</div>
			</div>
		</AdminShell>
	);
}
