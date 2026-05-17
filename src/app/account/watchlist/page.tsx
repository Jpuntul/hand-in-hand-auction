import Link from "next/link";
import { redirect } from "next/navigation";
import { Gavel } from "lucide-react";

import { UserMenu } from "@/components/auth/user-menu";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/queries";
import { createClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";
import { ItemsGrid } from "@/app/bidding/items-grid";

export default async function WatchlistPage() {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("watchlist")
    .select("item:items(*)")
    .eq("user_id", user.id);

  const items: Item[] = ((rows ?? []) as Array<{ item: Item | null }>)
    .map((r) => r.item)
    .filter((it): it is Item => it != null);
  const watchedIds = items.map((it) => it.id);

  return (
    <div className="container mx-auto max-w-6xl space-y-8 py-8 px-4">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Gavel className="h-6 w-6" />
          <span className="text-xl font-semibold">Hand in Hand</span>
        </Link>
        <UserMenu
          email={user.email ?? null}
          displayName={profile?.display_name ?? null}
          isAdmin={profile?.is_admin ?? false}
        />
      </header>

      <section className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Watchlist</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"} starred
        </p>
      </section>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nothing here yet</CardTitle>
            <CardDescription>
              Star items from the auction to track them here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/bidding"
              className={buttonVariants({ size: "sm" })}
            >
              Browse auction
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ItemsGrid
          initialItems={items}
          userId={user.id}
          watchedItemIds={watchedIds}
        />
      )}
    </div>
  );
}
