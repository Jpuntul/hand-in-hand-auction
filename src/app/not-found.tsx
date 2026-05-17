import Link from "next/link";

import { SiteShell } from "@/components/site-shell";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/queries";

export default async function NotFound() {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  return (
    <SiteShell
      size="narrow"
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
      <div className="flex flex-col items-center gap-6 py-16 text-center">
        <h1 className="text-6xl font-bold tracking-tight">404</h1>
        <p className="text-lg text-muted-foreground">
          That page doesn't exist, or the item you're looking for was removed.
        </p>
        <div className="flex gap-3">
          <Link href="/" className={buttonVariants({ size: "lg" })}>
            Home
          </Link>
          <Link
            href="/bidding"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Browse auction
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}
