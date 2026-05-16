"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { Item } from "@/lib/types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type PlaceBidResult = {
  ok?: boolean;
  amount?: number;
  extended_end_time?: string | null;
  new_end_time?: string | null;
};

export function BidDialog({
  item,
  minBid,
  open,
  onOpenChange,
}: {
  item: Item;
  minBid: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const schema = z.object({
    amount: z
      .number({ message: "Enter a valid amount" })
      .min(minBid, `Minimum bid is ${usd.format(minBid)}`),
  });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: minBid },
  });

  const onSubmit = async ({ amount }: FormValues) => {
    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("place_bid", {
      p_item_id: item.id,
      p_amount: amount,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const result = (data as PlaceBidResult) ?? {};

    if (result.extended_end_time) {
      const endStr = new Date(result.extended_end_time).toLocaleTimeString();
      toast.success(
        `Bid placed: ${usd.format(amount)} — auction extended to ${endStr}`,
      );
    } else {
      toast.success(`Bid placed: ${usd.format(amount)}`);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Place bid on {item.name}</DialogTitle>
          <DialogDescription>
            {item.current_bid != null
              ? `Current bid: ${usd.format(Number(item.current_bid))}`
              : "No bids yet"}{" "}
            · Minimum next bid: {usd.format(minBid)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bid-amount">Your bid (USD)</Label>
            <Input
              id="bid-amount"
              type="number"
              step="1"
              min={minBid}
              {...register("amount", { valueAsNumber: true })}
              autoFocus
            />
            {errors.amount && (
              <p className="text-sm text-destructive">
                {errors.amount.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              If a bid lands in the last 60 seconds, the auction is
              automatically extended by 60 seconds (anti-sniping).
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Placing…" : "Place bid"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
