import Link from "next/link";
import { Gavel } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { UserMenu } from "@/components/auth/user-menu";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/queries";
import { createClient } from "@/lib/supabase/server";
import { ItemsGrid } from "./items-grid";

export default async function BiddingPage() {
  const [supabase, user, profile] = await Promise.all([
    createClient(),
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  const { data: items } = await supabase
    .from("items")
    .select("*")
    .in("status", ["open", "scheduled"])
    .order("end_time", { ascending: true, nullsFirst: false });

  return (
    <div className="container mx-auto max-w-6xl space-y-8 py-8 px-4">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Gavel className="h-6 w-6" />
          <span className="text-xl font-semibold">Hand in Hand</span>
        </Link>
        {user ? (
          <UserMenu
            email={user.email ?? null}
            displayName={profile?.display_name ?? null}
            isAdmin={profile?.is_admin ?? false}
          />
        ) : (
          <Link
            href="/login"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Sign in to bid
          </Link>
        )}
      </header>

      <section className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Auction</h1>
        <p className="text-sm text-muted-foreground">
          {items?.length ?? 0} item{items?.length === 1 ? "" : "s"} available.
        </p>
      </section>

      {items && items.length > 0 ? (
        <ItemsGrid initialItems={items} userId={user?.id ?? null} />
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
  );
}
