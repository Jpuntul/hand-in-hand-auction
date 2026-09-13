import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { AdminToggle } from "./admin-toggle";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function UsersPage({
	searchParams,
}: {
	searchParams: Promise<{ page?: string }>;
}) {
	const { page } = await searchParams;
	const pageNumber = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
	const from = (pageNumber - 1) * PAGE_SIZE;
	const to = from + PAGE_SIZE - 1;

	const supabase = await createClient();

	// Fetch paginated profiles and total count alongside pre-aggregated bid counts
	const [{ data: profiles, count }, { data: bidCounts }] = await Promise.all([
		supabase
			.from("profiles")
			.select("id, display_name, email, created_at, is_admin", {
				count: "exact",
			})
			.order("created_at", { ascending: false })
			.range(from, to),
		supabase.from("user_bid_counts").select("*"),
	]);

	const totalUsers = count ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));

	const countMap: Record<string, number> = {};
	for (const b of bidCounts ?? []) {
		if (b.user_id) {
			countMap[b.user_id] = Number(b.bid_count ?? 0);
		}
	}

	const startRecord = totalUsers === 0 ? 0 : from + 1;
	const endRecord = Math.min(to + 1, totalUsers);

	return (
		<AdminShell size="wide">
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
						Users
					</h1>
					<p className="text-sm text-muted-foreground">
						{totalUsers} registered accounts. Toggle the switch to promote or
						revoke admin access.
					</p>
				</div>

				<div className="overflow-hidden rounded-xl border border-border/60 bg-card">
					<Table>
						<TableHeader>
							<TableRow className="bg-muted/30">
								<TableHead className="text-xs uppercase tracking-wider">
									Name
								</TableHead>
								<TableHead className="text-xs uppercase tracking-wider">
									Email
								</TableHead>
								<TableHead className="text-center text-xs uppercase tracking-wider">
									Bids
								</TableHead>
								<TableHead className="text-xs uppercase tracking-wider">
									Joined
								</TableHead>
								<TableHead className="text-xs uppercase tracking-wider">
									Role
								</TableHead>
								<TableHead className="text-xs uppercase tracking-wider">
									Admin
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{!profiles?.length ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="py-8 text-center text-sm text-muted-foreground"
									>
										No users yet.
									</TableCell>
								</TableRow>
							) : (
								profiles.map((p) => (
									<TableRow key={p.id} className="border-b border-border/40">
										<TableCell className="font-medium">
											{p.display_name ?? "—"}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{p.email ?? "—"}
										</TableCell>
										<TableCell className="text-center text-sm">
											{countMap[p.id] ?? 0}
										</TableCell>
										<TableCell className="text-xs text-muted-foreground">
											{new Date(p.created_at).toLocaleDateString()}
										</TableCell>
										<TableCell>
											<Badge variant={p.is_admin ? "default" : "secondary"}>
												{p.is_admin ? "Admin" : "Bidder"}
											</Badge>
										</TableCell>
										<TableCell>
											<AdminToggle userId={p.id} isAdmin={p.is_admin} />
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>

				{totalPages > 1 && (
					<div className="flex items-center justify-between px-2">
						<p className="text-xs text-muted-foreground">
							Showing {startRecord}–{endRecord} of {totalUsers}
						</p>
						<div className="flex items-center gap-2">
							{pageNumber > 1 ? (
								<Link
									href={`/admin/users?page=${pageNumber - 1}`}
									className={buttonVariants({ variant: "outline", size: "sm" })}
								>
									Previous
								</Link>
							) : (
								<Button variant="outline" size="sm" disabled>
									Previous
								</Button>
							)}
							<span className="text-xs text-muted-foreground px-2">
								Page {pageNumber} of {totalPages}
							</span>
							{pageNumber < totalPages ? (
								<Link
									href={`/admin/users?page=${pageNumber + 1}`}
									className={buttonVariants({ variant: "outline", size: "sm" })}
								>
									Next
								</Link>
							) : (
								<Button variant="outline" size="sm" disabled>
									Next
								</Button>
							)}
						</div>
					</div>
				)}
			</div>
		</AdminShell>
	);
}
