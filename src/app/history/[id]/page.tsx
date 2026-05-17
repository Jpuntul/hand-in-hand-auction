import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Gavel, Trophy, Users } from "lucide-react";

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
import { SiteShell } from "@/components/site-shell";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/queries";
import { createClient } from "@/lib/supabase/server";
import type { ItemStatus } from "@/lib/types";
import { BidCta } from "./bid-cta";
import { ImageGallery } from "./image-gallery";

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
  user_id: string;
  created_at: string;
  extended_end_time: string | null;
  bidder: { display_name: string | null } | null;
};

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [supabase, user, profile] = await Promise.all([
    createClient(),
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  const [{ data: item }, { data: bids }] = await Promise.all([
    supabase.from("items").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("bid_history")
      .select(
        "id, amount, user_id, created_at, extended_end_time, bidder:profiles!user_id(display_name)",
      )
      .eq("item_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!item) notFound();

  const rows = (bids ?? []) as unknown as BidRow[];
  const uniqueBidders = new Set(rows.map((b) => b.user_id)).size;
  const topBidder = rows[0]?.bidder?.display_name ?? null;

  return (
    <SiteShell
      size="wide"
      user={
        user
          ? {
              email: user.email ?? null,
              displayName: profile?.display_name ?? null,
              isAdmin: profile?.is_admin ?? false,
            }
          : null
      }
    >
      <div className="space-y-8">
        {/* ── Back nav ───────────────────────────────── */}
        <Link
          href="/bidding"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to auction
        </Link>

        {/* ── Hero image ─────────────────────────────── */}
        {item.image_urls.length > 0 && (
          <ImageGallery urls={item.image_urls} name={item.name} />
        )}

        {/* ── Title block ────────────────────────────── */}
        <div className="space-y-3 text-center">
          {item.categories && (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DAA520]">
              {item.categories}
            </p>
          )}
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {item.name}
          </h1>
          {item.sponsor && (
            <p className="text-muted-foreground">
              Graciously donated by{" "}
              <span className="font-medium">{item.sponsor}</span>
            </p>
          )}
          <div className="flex items-center justify-center gap-3">
            <Badge variant={statusVariant[item.status]} className="capitalize">
              {item.status === "open"
                ? "Open for bids"
                : item.status === "closed"
                  ? "Auction closed"
                  : item.status}
            </Badge>
            {item.item_no && (
              <span className="text-xs text-muted-foreground">
                Lot #{item.item_no}
              </span>
            )}
          </div>
        </div>

        {/* ── Gold divider ────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-[#DAA520]/30" />
          <Gavel className="h-5 w-5 text-[#DAA520]/60" />
          <div className="h-px flex-1 bg-[#DAA520]/30" />
        </div>

        {/* ── Main body: description + bid panel ─────── */}
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Left — description + item details */}
          <div className="space-y-6 lg:col-span-3">
            {item.description && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-widest">
                  About this item
                </h2>
                <p className="leading-relaxed text-muted-foreground whitespace-pre-line">
                  {item.description}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-widest">
                Auction details
              </h2>
              <dl className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card/80 text-sm">
                {item.retail_value && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-muted-foreground">Estimated value</dt>
                    <dd className="font-semibold text-[#DAA520]">
                      {usd.format(Number(item.retail_value))}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-muted-foreground">Starting bid</dt>
                  <dd className="font-medium">
                    {usd.format(Number(item.starting_bid))}
                  </dd>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-muted-foreground">Bid increment</dt>
                  <dd className="font-medium">
                    {usd.format(Number(item.bid_increment))}
                  </dd>
                </div>
                {item.start_time && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-muted-foreground">Opens</dt>
                    <dd className="font-medium">
                      {new Date(item.start_time).toLocaleString()}
                    </dd>
                  </div>
                )}
                {item.end_time && (
                  <div className="flex justify-between px-4 py-3">
                    <dt className="text-muted-foreground">
                      {item.status === "closed" ? "Closed" : "Closes"}
                    </dt>
                    <dd className="font-medium">
                      {new Date(item.end_time).toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Right — sticky bid panel */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-24 space-y-4">
              <div className="rounded-2xl border border-[#DAA520]/30 bg-card shadow-xl shadow-[#DAA520]/5 p-6 space-y-5">
                {/* Current price */}
                <div className="space-y-1 text-center border-b border-border/50 pb-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                    {item.current_bid != null ? "Current bid" : "Starting bid"}
                  </p>
                  <p className="font-heading text-5xl font-bold text-[#DAA520] leading-none">
                    {usd.format(
                      Number(item.current_bid ?? item.starting_bid),
                    )}
                  </p>
                  {item.current_bid != null && (
                    <p className="text-xs text-muted-foreground">
                      Next minimum:{" "}
                      <span className="font-medium text-foreground">
                        {usd.format(
                          Number(item.current_bid) +
                            Number(item.bid_increment),
                        )}
                      </span>
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <Gavel className="h-4 w-4 text-[#DAA520]" />
                    <div>
                      <p className="text-lg font-bold leading-none">
                        {item.bid_count}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Bids
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <Users className="h-4 w-4 text-[#DAA520]" />
                    <div>
                      <p className="text-lg font-bold leading-none">
                        {uniqueBidders}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Bidders
                      </p>
                    </div>
                  </div>
                </div>

                {/* Leading bidder */}
                {topBidder && item.status !== "closed" && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Leading: </span>
                    <span className="font-semibold">{topBidder}</span>
                  </div>
                )}

                {/* Winner */}
                {item.status === "closed" && item.winner_user_id && (
                  <div className="rounded-lg border border-[#DAA520]/40 bg-[#DAA520]/10 p-3 text-center space-y-1">
                    <Trophy className="mx-auto h-5 w-5 text-[#DAA520]" />
                    <p className="font-semibold text-sm text-[#DAA520]">
                      Won by {topBidder ?? "a bidder"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Final price:{" "}
                      <span className="font-medium">
                        {usd.format(Number(item.winning_bid))}
                      </span>
                    </p>
                  </div>
                )}

                {/* CTA */}
                <BidCta item={item} userId={user?.id ?? null} />

                {!user && item.status === "open" && (
                  <p className="text-center text-xs text-muted-foreground">
                    <Link href="/login" className="underline hover:text-foreground">
                      Sign in
                    </Link>{" "}
                    to participate in this auction
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Gold divider ────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-[#DAA520]/30" />
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#DAA520]/60">
            Bid History
          </span>
          <div className="h-px flex-1 bg-[#DAA520]/30" />
        </div>

        {/* ── Bid history table ───────────────────────── */}
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No bids yet — be the first to bid on this item.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#DAA520]/20 bg-[#122c7a]/5">
                  <TableHead className="text-[10px] uppercase tracking-wider">
                    Rank
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">
                    Bidder
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">
                    Amount
                  </TableHead>
                  <TableHead className="hidden text-[10px] uppercase tracking-wider sm:table-cell">
                    Time
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b, i) => {
                  const isTop = i === 0;
                  return (
                    <TableRow
                      key={b.id}
                      className={
                        isTop
                          ? "bg-[#DAA520]/8 border-b border-[#DAA520]/15"
                          : "border-b border-border/40"
                      }
                    >
                      <TableCell className="py-3">
                        {isTop ? (
                          <Trophy className="h-4 w-4 text-[#DAA520]" />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {rows.length - i}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <span
                          className={
                            isTop
                              ? "font-semibold text-[#DAA520]"
                              : "text-sm"
                          }
                        >
                          {b.bidder?.display_name ?? "Bidder"}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 font-mono">
                        <span
                          className={
                            isTop ? "font-bold text-[#DAA520]" : "text-sm"
                          }
                        >
                          {usd.format(Number(b.amount))}
                        </span>
                        {b.extended_end_time && (
                          <span className="ml-2 rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-700">
                            +60s
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden py-3 text-xs text-muted-foreground sm:table-cell">
                        {new Date(b.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
