"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

import { SiteShell } from "@/components/site-shell";
import { Button, buttonVariants } from "@/components/ui/button";

export default function ErrorPage({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
			Sentry.captureException(error);
		} else {
			console.error(error);
		}
	}, [error]);

	return (
		<SiteShell size="narrow" user={null}>
			<div className="flex flex-col items-center gap-6 py-16 text-center">
				<h1 className="text-4xl font-bold tracking-tight">
					Something went wrong
				</h1>
				<p className="text-sm text-muted-foreground">
					An unexpected error occurred. Please try again or return home.
				</p>
				{error.digest && (
					<p className="font-mono text-xs text-muted-foreground">
						Error ID: {error.digest}
					</p>
				)}
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
