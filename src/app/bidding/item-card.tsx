"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { WatchlistStar } from "@/components/watchlist-star";
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

function Countdown({
  endTime,
  getNow,
}: {
  endTime: string;
  getNow: () => number;
}) {
  const [, force] = useState(0);

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, new Date(endTime).getTime() - getNow());
  if (remaining === 0) return <>ended</>;

  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const label =
    days > 0
      ? `${days}d ${hours}h`
      : hours > 0
        ? `${hours}h ${minutes}m`
        : minutes > 0
          ? `${minutes}m ${seconds}s`
          : `${seconds}s`;

  return (
    <span
      className={remaining < 60_000 ? "font-medium text-destructive" : undefined}
    >
      {label}
    </span>
  );
}

export function ItemCard({
  item,
  userId,
  getNow,
  isWatched = false,
}: {
  item: Item;
  userId: string | null;
  getNow: () => number;
  isWatched?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const minBid =
    item.current_bid != null
      ? Number(item.current_bid) + Number(item.bid_increment)
      : Number(item.starting_bid);

  const isExpired = item.end_time
    ? new Date(item.end_time).getTime() <= getNow()
    : false;
  const isYourBid = userId != null && item.current_bidder_id === userId;
  const canBid = userId != null && item.status === "open" && !isExpired;
  const firstImage = item.image_urls?.[0];

  return (
    <Card className="flex flex-col overflow-hidden">
      {firstImage && (
        <div className="relative aspect-video w-full bg-muted">
          <Image
            src={firstImage}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        </div>
      )}
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{item.name}</CardTitle>
          <div className="flex shrink-0 items-center gap-1">
            {item.categories && (
              <Badge variant="outline" className="capitalize">
                {item.categories}
              </Badge>
            )}
            {item.item_no != null && (
              <Badge variant="secondary">#{item.item_no}</Badge>
            )}
            {userId && <WatchlistStar itemId={item.id} initial={isWatched} />}
          </div>
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
            <Link
              href={`/history/${item.id}`}
              className="hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {item.bid_count} bid{item.bid_count === 1 ? "" : "s"}
            </Link>
            {isYourBid && (
              <Badge variant="default" className="h-4 px-1.5 text-[10px]">
                You're winning
              </Badge>
            )}
            <span>min next: {fmt(minBid)}</span>
          </div>
          {item.end_time && (
            <div className="text-xs text-muted-foreground">
              {isExpired ? (
                <>Auction ended</>
              ) : (
                <>
                  Ends in <Countdown endTime={item.end_time} getNow={getNow} />
                </>
              )}
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
