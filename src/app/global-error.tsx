"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
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
		<html lang="en">
			<body>
				<div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
					<h1 className="text-4xl font-bold tracking-tight">
						Something went wrong
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						A critical error occurred. Please try again.
					</p>
					{error.digest && (
						<p className="mt-2 font-mono text-xs text-muted-foreground">
							Error ID: {error.digest}
						</p>
					)}
					<button
						type="button"
						onClick={reset}
						className="mt-6 rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
					>
						Try again
					</button>
				</div>
			</body>
		</html>
	);
}
