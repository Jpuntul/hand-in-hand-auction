import Link from "next/link";
import { Gavel } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { UserMenu, type UserMenuProps } from "@/components/auth/user-menu";

/**
 * Site-wide layout shell. Pages render their content inside a SiteShell to
 * inherit:
 *  - a consistent sticky header (logo + UserMenu, or Sign-in CTA)
 *  - a responsive main container whose max-width matches the page type
 *  - consistent vertical padding that scales with viewport size
 *
 * Widths:
 *  - narrow  → forms & single-card pages (login, profile, notifications)
 *  - default → single-record detail pages (bid history)
 *  - wide    → grids and tables (auction, watchlist, admin items)
 */
const widths = {
  narrow: "max-w-md",
  default: "max-w-3xl",
  wide: "max-w-6xl",
} as const;

export type SiteShellSize = keyof typeof widths;

export function SiteShell({
  size = "default",
  user,
  brand = "Hand in Hand",
  children,
}: {
  size?: SiteShellSize;
  user: UserMenuProps | null;
  brand?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16">
          <Link
            href="/"
            className="flex items-center gap-2 text-foreground transition-colors hover:text-primary"
          >
            <Gavel className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="text-base font-semibold sm:text-lg">{brand}</span>
          </Link>
          {user ? (
            <UserMenu {...user} />
          ) : (
            <Link
              href="/login"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Sign in
            </Link>
          )}
        </div>
      </header>
      <main
        className={`mx-auto w-full ${widths[size]} flex-1 px-4 py-6 sm:py-8 lg:py-10`}
      >
        {children}
      </main>
    </>
  );
}
