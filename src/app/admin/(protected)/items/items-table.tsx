"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Item } from "@/lib/types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const statusVariant: Record<Item["status"], "default" | "secondary" | "outline" | "destructive"> = {
  scheduled: "secondary",
  open: "default",
  closed: "outline",
  cancelled: "destructive",
};

export function ItemsTable({ items }: { items: Item[] }) {
  const router = useRouter();

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
            <TableRow
              key={item.id}
              className="cursor-pointer"
              onClick={() => router.push(`/admin/items/${item.id}/edit`)}
            >
              <TableCell className="text-xs text-muted-foreground">
                {item.item_no ?? "—"}
              </TableCell>
              <TableCell className="font-medium">{item.name}</TableCell>
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
                  variant={statusVariant[item.status]}
                  className="capitalize"
                >
                  {item.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {usd.format(
                  Number(item.current_bid ?? item.starting_bid),
                )}
              </TableCell>
              <TableCell className="text-right">{item.bid_count}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {item.end_time
                  ? new Date(item.end_time).toLocaleString()
                  : "—"}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon-sm">
                  <Pencil className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
