"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

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
import type { Item } from "@/lib/types";
import { BidDialog } from "./bid-dialog";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const fmt = (n: number | string | null): string =>
  n == null ? "—" : usd.format(Number(n));

export function ItemCard({
  item,
  userId,
}: {
  item: Item;
  userId: string | null;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const minBid =
    item.current_bid != null
      ? Number(item.current_bid) + Number(item.bid_increment)
      : Number(item.starting_bid);

  const endTime = item.end_time ? new Date(item.end_time) : null;
  const isExpired = endTime ? endTime.getTime() < Date.now() : false;
  const isYourBid = userId != null && item.current_bidder_id === userId;
  const canBid =
    userId != null && item.status === "open" && !isExpired;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{item.name}</CardTitle>
          {item.item_no != null && (
            <Badge variant="secondary">#{item.item_no}</Badge>
          )}
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
              {fmt(item.current_bid ?? item.starting_bid)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {item.bid_count} bid{item.bid_count === 1 ? "" : "s"}
              {isYourBid && (
                <Badge variant="default" className="ml-2 h-4 px-1.5 text-[10px]">
                  You're winning
                </Badge>
              )}
            </span>
            <span>min next: {fmt(minBid)}</span>
          </div>
          {endTime && (
            <div className="text-xs text-muted-foreground">
              {isExpired
                ? "Auction ended"
                : `Ends ${formatDistanceToNow(endTime, { addSuffix: true })}`}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          disabled={!canBid}
          onClick={() => setDialogOpen(true)}
        >
          {!userId
            ? "Sign in to bid"
            : isExpired
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
