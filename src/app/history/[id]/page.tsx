import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import type { ItemStatus } from "@/lib/types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const statusVariant: Record<
  ItemStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  scheduled: "secondary",
  open: "default",
  closed: "outline",
  cancelled: "destructive",
};

type BidRow = {
  id: number;
  amount: number;
  created_at: string;
  extended_end_time: string | null;
  bidder: { display_name: string | null } | null;
};

export default async function ItemHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: item }, { data: bids }] = await Promise.all([
    supabase.from("items").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("bid_history")
      .select(
        "id, amount, created_at, extended_end_time, bidder:profiles!user_id(display_name)",
      )
      .eq("item_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!item) notFound();
  const rows = ((bids ?? []) as unknown as BidRow[]) ?? [];

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-8 px-4">
      <Link
        href="/bidding"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Back to auction
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>{item.name}</CardTitle>
              {item.sponsor && (
                <CardDescription>donated by {item.sponsor}</CardDescription>
              )}
            </div>
            <Badge variant={statusVariant[item.status]} className="capitalize">
              {item.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 text-sm sm:grid-cols-3">
            <div>
              <div className="text-muted-foreground">
                {item.current_bid != null ? "Current bid" : "Starting bid"}
              </div>
              <div className="text-xl font-semibold">
                {usd.format(Number(item.current_bid ?? item.starting_bid))}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Total bids</div>
              <div className="text-xl font-semibold">{item.bid_count}</div>
            </div>
            {item.end_time && (
              <div className="sm:col-start-3">
                <div className="text-muted-foreground">
                  {item.status === "closed" ? "Ended" : "Ends"}
                </div>
                <div className="font-semibold">
                  {new Date(item.end_time).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bid history</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No bids yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Bidder</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(b.created_at).toLocaleString()}
                      {b.extended_end_time && (
                        <span className="ml-2 text-amber-600">
                          (anti-snipe)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {b.bidder?.display_name ?? "Bidder"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {usd.format(Number(b.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
