import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-24 text-center">
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
  );
}
