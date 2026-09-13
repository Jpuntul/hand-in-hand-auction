import { Pencil } from "lucide-react";
import Link from "next/link";

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
import type { Item } from "@/lib/types";

export function ItemsTable({ items }: { items: Item[] }) {
	if (items.length === 0) {
		return (
			<p className="py-12 text-center text-sm text-muted-foreground">
				No items yet.{" "}
				<Link href="/admin/items/new" className="underline">
					Create the first one
				</Link>
				.
			</p>
		);
	}

	return (
		<div className="rounded-lg border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-12">#</TableHead>
						<TableHead>Name</TableHead>
						<TableHead>Category</TableHead>
						<TableHead>Status</TableHead>
						<TableHead className="text-right">Current bid</TableHead>
						<TableHead className="text-right">Bids</TableHead>
						<TableHead>Ends</TableHead>
						<TableHead className="w-12" />
					</TableRow>
				</TableHeader>
				<TableBody>
					{items.map((item) => (
						<TableRow key={item.id}>
							<TableCell className="text-xs text-muted-foreground">
								{item.item_no ?? "—"}
							</TableCell>
							<TableCell className="font-medium">
								<Link
									href={`/admin/items/${item.id}/edit`}
									className="hover:underline"
								>
									{item.name}
								</Link>
							</TableCell>
							<TableCell>
								{item.categories ? (
									<Badge variant="outline" className="capitalize">
										{item.categories}
									</Badge>
								) : (
									<span className="text-xs text-muted-foreground">—</span>
								)}
							</TableCell>
							<TableCell>
								<Badge
									variant={STATUS_VARIANT[item.status]}
									className="capitalize"
								>
									{item.status}
								</Badge>
							</TableCell>
							<TableCell className="text-right">
								{formatUsd(item.current_bid ?? item.starting_bid)}
							</TableCell>
							<TableCell className="text-right">{item.bid_count}</TableCell>
							<TableCell className="text-xs text-muted-foreground">
								{item.end_time ? new Date(item.end_time).toLocaleString() : "—"}
							</TableCell>
							<TableCell>
								<Link
									href={`/admin/items/${item.id}/edit`}
									className={buttonVariants({
										variant: "ghost",
										size: "icon-sm",
									})}
								>
									<Pencil className="h-4 w-4" />
								</Link>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
