import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { SiteShell } from "@/components/site-shell";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/queries";

export default async function HomePage() {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);

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
      <section className="space-y-6 py-12 text-center sm:py-20">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Charity Auction for Myanmar
        </h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
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
    </SiteShell>
  );
}
