import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SiteShell } from "@/components/site-shell";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/queries";
import { createClient } from "@/lib/supabase/server";
import { ItemsGrid } from "./items-grid";

export default async function BiddingPage() {
  const [supabase, user, profile] = await Promise.all([
    createClient(),
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  const [{ data: items }, { data: watched }] = await Promise.all([
    supabase
      .from("items")
      .select("*")
      .in("status", ["open", "scheduled"])
      .order("end_time", { ascending: true, nullsFirst: false }),
    user
      ? supabase.from("watchlist").select("item_id").eq("user_id", user.id)
      : Promise.resolve({ data: null }),
  ]);
  const watchedIds = (watched ?? []).map((w) => w.item_id);

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
      <div className="space-y-6 sm:space-y-8">
        <section className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Auction
          </h1>
          <p className="text-sm text-muted-foreground">
            {items?.length ?? 0} item{items?.length === 1 ? "" : "s"} available.
          </p>
        </section>

        {items && items.length > 0 ? (
          <ItemsGrid
            initialItems={items}
            userId={user?.id ?? null}
            watchedItemIds={watchedIds}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No items yet</CardTitle>
              <CardDescription>
                Auction items appear here once an admin creates them.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {profile?.is_admin ? (
                <p>
                  <Link href="/admin" className="underline">
                    Go to admin
                  </Link>{" "}
                  to add the first item.
                </p>
              ) : (
                <p>Check back soon.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </SiteShell>
  );
}
