"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Item } from "@/lib/types";
import { ItemCard } from "./item-card";

export function ItemsGrid({
  initialItems,
  userId,
}: {
  initialItems: Item[];
  userId: string | null;
}) {
  const [items, setItems] = useState<Item[]>(initialItems);

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
            prev.map((it) => (it.id === updated.id ? updated : it)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "items" },
        (payload) => {
          const inserted = payload.new as Item;
          // Only show open/scheduled items
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

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} userId={userId} />
      ))}
    </div>
  );
}
