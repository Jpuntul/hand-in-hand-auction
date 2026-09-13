"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const NowContext = createContext<number | null>(null);

/**
 * Returns the current server-corrected epoch ms, updating every intervalMs (default 1000ms).
 * Keeps a single interval running that also drives the 30s background server clock re-sync.
 */
export function useNow(intervalMs = 1000): number {
	const offsetRef = useRef(0);
	const tickCountRef = useRef(0);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		let cancelled = false;
		const supabase = createClient();

		const sync = async () => {
			const t1 = Date.now();
			const { data, error } = await supabase.rpc("server_time");
			const t2 = Date.now();
			if (cancelled || error || !data) return;
			const serverNow = new Date(data).getTime();
			const localMidpoint = t1 + (t2 - t1) / 2;
			offsetRef.current = serverNow - localMidpoint;
			setNow(Date.now() + offsetRef.current);
		};

		void sync();

		const ticksPerSync = Math.max(1, Math.round(30_000 / intervalMs));
		const id = setInterval(() => {
			setNow(Date.now() + offsetRef.current);
			tickCountRef.current += 1;
			if (tickCountRef.current >= ticksPerSync) {
				tickCountRef.current = 0;
				void sync();
			}
		}, intervalMs);

		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, [intervalMs]);

	return now;
}

/**
 * Hook to consume the nearest NowContext if available, or fall back to local useNow.
 */
export function useNowContext(): number {
	const ctx = useContext(NowContext);
	const localNow = useNow();
	return ctx ?? localNow;
}
