"use client";

import { useEffect, useMemo, useState } from "react";

import { useServerTime } from "@/hooks/use-server-time";
import { createClient } from "@/lib/supabase/client";
import type { Item, ItemCategory } from "@/lib/types";
import { CategoryFilter } from "./category-filter";
import { ItemCard } from "./item-card";

export function ItemsGrid({
  initialItems,
  userId,
  watchedItemIds = [],
}: {
  initialItems: Item[];
  userId: string | null;
  watchedItemIds?: string[];
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [filter, setFilter] = useState<ItemCategory | null>(null);
  const getNow = useServerTime();
  const watchedSet = new Set(watchedItemIds);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("items-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "items" },
        (payload) => {
          const updated = payload.new as Item;
          setItems((prev) =>
            prev.some((it) => it.id === updated.id)
              ? prev.map((it) => (it.id === updated.id ? updated : it))
              : prev,
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "items" },
        (payload) => {
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
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(
    () =>
      filter === null ? items : items.filter((it) => it.categories === filter),
    [items, filter],
  );

  return (
    <div className="space-y-6">
      <CategoryFilter value={filter} onChange={setFilter} />
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
              getNow={getNow}
              isWatched={watchedSet.has(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
