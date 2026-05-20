"use client";

import { useState } from "react";
import { toast } from "sonner";

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
import {
  cancelLastBid,
  extendDeadline,
  forceCloseItem,
  pauseItem,
} from "./override-actions";

export function ItemOverrides({ itemId }: { itemId: string }) {
  const [busy, setBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const run = async (
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ) => {
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? `${label} failed`);
    } else {
      toast.success(`${label} applied`);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <div>
        <p className="text-sm font-semibold">Admin overrides</p>
        <p className="text-xs text-muted-foreground">
          All actions are logged to the audit log.
        </p>
      </div>

      {/* Extend deadline */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Extend deadline
        </p>
        <div className="flex flex-wrap gap-2">
          {[15, 30, 60].map((mins) => (
            <Button
              key={mins}
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                run(`Extend +${mins}m`, () => extendDeadline(itemId, mins))
              }
            >
              +{mins}m
            </Button>
          ))}
        </div>
      </div>

      {/* Status overrides */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Status
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => run("Pause", () => pauseItem(itemId))}
          >
            Pause
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (!confirm("Force close this auction now?")) return;
              run("Force close", () => forceCloseItem(itemId));
            }}
          >
            Force close
          </Button>
        </div>
      </div>

      {/* Cancel last bid */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Bid management
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setShowCancelDialog(true)}
        >
          Cancel last bid
        </Button>
      </div>

      {/* Cancel bid dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel last bid</DialogTitle>
            <DialogDescription>
              This deletes the most recent bid and restores the previous leading
              bid. The action is permanent and logged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (required)</Label>
            <Input
              id="reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. duplicate bid, test entry"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!cancelReason.trim() || busy}
              onClick={async () => {
                setShowCancelDialog(false);
                await run("Cancel bid", () =>
                  cancelLastBid(itemId, cancelReason),
                );
                setCancelReason("");
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
