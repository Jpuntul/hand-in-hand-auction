"use client";

import Link from "next/link";
import { useEffect } from "react";

import { SiteShell } from "@/components/site-shell";
import { Button, buttonVariants } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Wire to Sentry here when configured (DEPLOY.md).
    console.error(error);
  }, [error]);

  return (
    <SiteShell size="narrow" user={null}>
      <div className="flex flex-col items-center gap-6 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <div className="flex gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Go home
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}
