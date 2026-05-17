"use client";

import { useCallback, useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Returns a getter that gives the current time according to the DATABASE
 * clock (with a network-RTT correction), not the user's laptop clock.
 *
 * Re-syncs every 30 seconds in the background. The getter is stable
 * across renders.
 */
export function useServerTime() {
  const offsetRef = useRef(0);

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
    };

    void sync();
    const id = setInterval(sync, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return useCallback(() => Date.now() + offsetRef.current, []);
}
