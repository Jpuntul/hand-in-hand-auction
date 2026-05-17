"use client";

import { useEffect, useState } from "react";

import { BidDialog } from "@/app/bidding/bid-dialog";
import { Button } from "@/components/ui/button";
import { useServerTime } from "@/hooks/use-server-time";
import type { Item } from "@/lib/types";

export function BidCta({
  item,
  userId,
}: {
  item: Item;
  userId: string | null;
}) {
  const getNow = useServerTime();
  const [, tick] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const isExpired = item.end_time
    ? new Date(item.end_time).getTime() <= getNow()
    : false;
  const isOpen = item.status === "open" && !isExpired;
  const canBid = !!userId && isOpen;

  const minBid =
    item.current_bid != null
      ? Number(item.current_bid) + Number(item.bid_increment)
      : Number(item.starting_bid);

  if (item.status === "closed" || isExpired) return null;

  return (
    <>
      <Button
        size="lg"
        className="w-full"
        disabled={!canBid}
        onClick={() => setOpen(true)}
      >
        {!userId
          ? "Sign in to bid"
          : item.status !== "open"
            ? "Auction not open yet"
            : "Place bid"}
      </Button>
      {open && (
        <BidDialog
          item={item}
          minBid={minBid}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
