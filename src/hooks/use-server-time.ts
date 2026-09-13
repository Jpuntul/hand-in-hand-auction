"use client";

import { useNow } from "./use-now";

export { NowContext, useNow, useNowContext } from "./use-now";

/**
 * Returns current server-corrected epoch ms, re-rendering on tick.
 * Replaces the old non-reactive getter so React Compiler won't memoize away time.
 */
export function useServerTime(intervalMs = 1000): number {
	return useNow(intervalMs);
}
