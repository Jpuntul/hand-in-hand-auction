import Link from "next/link";
import { Gavel } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { UserMenu } from "@/components/auth/user-menu";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/queries";

export default async function HomePage() {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  return (
    <div className="container mx-auto max-w-4xl space-y-16 py-12 px-4">
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
            Sign in
          </Link>
        )}
      </header>

      <section className="space-y-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Charity Auction for Myanmar
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Real-time bidding on items donated by sponsors. Every bid supports
          relief efforts on the ground.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link href="/bidding" className={buttonVariants({ size: "lg" })}>
            Browse auction
          </Link>
          {!user && (
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Sign in to bid
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
