"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { NowContext, useNow } from "@/hooks/use-now";
import { createClient } from "@/lib/supabase/client";
import type { Item, ItemCategory } from "@/lib/types";
import { CategoryFilter } from "./category-filter";
import { ItemCard } from "./item-card";

export function ItemsGrid({
	initialItems,
	userId,
	watchedItemIds = [],
	mode = "auction",
}: {
	initialItems: Item[];
	userId: string | null;
	watchedItemIds?: string[];
	mode?: "auction" | "watchlist";
}) {
	const [items, setItems] = useState<Item[]>(initialItems);
	const [filter, setFilter] = useState<ItemCategory | null>(null);
	const [connected, setConnected] = useState(true);
	const hadDisconnectRef = useRef(false);

	const watchedItemIdsRef = useRef(watchedItemIds);
	watchedItemIdsRef.current = watchedItemIds;
	const userIdRef = useRef(userId);
	userIdRef.current = userId;
	const modeRef = useRef(mode);
	modeRef.current = mode;

	const now = useNow();
	const watchedSet = new Set(watchedItemIds);

	// The server payload is the authority after a router.refresh() (e.g. following a bid or reconnect),
	// so we reconcile client items state when initialItems prop changes without needing a key remount.
	useEffect(() => {
		setItems(initialItems);
	}, [initialItems]);

	const refetchItems = useCallback(async () => {
		const supabase = createClient();
		if (modeRef.current === "auction") {
			const { data } = await supabase
				.from("items")
				.select("*")
				.in("status", ["open", "scheduled"])
				.order("end_time", { ascending: true, nullsFirst: false });
			if (data) {
				setItems(data);
			}
		} else if (modeRef.current === "watchlist") {
			if (userIdRef.current) {
				const { data: rows } = await supabase
					.from("watchlist")
					.select("item:items(*)")
					.eq("user_id", userIdRef.current);
				if (rows) {
					const freshItems = (rows as Array<{ item: Item | null }>)
						.map((r) => r.item)
						.filter(
							(it): it is Item =>
								it != null &&
								it.status !== "closed" &&
								it.status !== "cancelled",
						);
					setItems(freshItems);
				}
			} else if (watchedItemIdsRef.current.length > 0) {
				const { data } = await supabase
					.from("items")
					.select("*")
					.in("id", watchedItemIdsRef.current)
					.in("status", ["open", "scheduled"]);
				if (data) {
					setItems(data);
				}
			}
		}
	}, []);

	useEffect(() => {
		const supabase = createClient();
		const channel = supabase
			.channel("items-live")
			.on(
				"postgres_changes",
				{ event: "UPDATE", schema: "public", table: "items" },
				(payload) => {
					const updated = payload.new as Item;
					if (updated.status === "closed" || updated.status === "cancelled") {
						setItems((prev) => prev.filter((it) => it.id !== updated.id));
						return;
					}
					setItems((prev) => {
						const exists = prev.some((it) => it.id === updated.id);
						if (exists) {
							return prev.map((it) => (it.id === updated.id ? updated : it));
						}
						if (
							mode === "auction" &&
							(updated.status === "open" || updated.status === "scheduled")
						) {
							return [...prev, updated];
						}
						return prev;
					});
				},
			)
			.on(
				"postgres_changes",
				{ event: "INSERT", schema: "public", table: "items" },
				(payload) => {
					if (mode !== "auction") return;
					const inserted = payload.new as Item;
					if (inserted.status === "open" || inserted.status === "scheduled") {
						setItems((prev) =>
							prev.some((it) => it.id === inserted.id)
								? prev
								: [...prev, inserted],
						);
					}
				},
			)
			.on(
				"postgres_changes",
				{ event: "DELETE", schema: "public", table: "items" },
				(payload) => {
					const old = payload.old as { id?: string };
					if (old.id) {
						setItems((prev) => prev.filter((it) => it.id !== old.id));
					}
				},
			)
			.subscribe((status) => {
				if (status === "SUBSCRIBED") {
					setConnected(true);
					if (hadDisconnectRef.current) {
						hadDisconnectRef.current = false;
						void refetchItems();
					}
				} else if (
					status === "CLOSED" ||
					status === "CHANNEL_ERROR" ||
					status === "TIMED_OUT"
				) {
					hadDisconnectRef.current = true;
					setConnected(false);
				}
			});

		const handleOffline = () => {
			hadDisconnectRef.current = true;
			setConnected(false);
		};

		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("offline", handleOffline);
			void supabase.removeChannel(channel);
		};
	}, [mode, refetchItems]);

	const filtered = useMemo(
		() =>
			filter === null ? items : items.filter((it) => it.categories === filter),
		[items, filter],
	);

	return (
		<NowContext.Provider value={now}>
			<div className="space-y-6">
				<div className="flex items-center justify-between gap-4">
					<CategoryFilter value={filter} onChange={setFilter} />
					{!connected && (
						<span
							role="status"
							className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse"
						>
							<span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
							Reconnecting…
						</span>
					)}
				</div>
				{filtered.length === 0 ? (
					<p className="py-12 text-center text-sm text-muted-foreground">
						No items in this category.
					</p>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{filtered.map((item) => (
							<ItemCard
								key={item.id}
								item={item}
								userId={userId}
								isWatched={watchedSet.has(item.id)}
							/>
						))}
					</div>
				)}
			</div>
		</NowContext.Provider>
	);
}
