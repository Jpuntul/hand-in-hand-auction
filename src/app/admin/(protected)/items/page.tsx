import Link from "next/link";
import { Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ItemsTable } from "./items-table";

export const dynamic = "force-dynamic";

export default async function AdminItemsPage() {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-8 px-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Items</h1>
          <p className="text-sm text-muted-foreground">
            {items?.length ?? 0} total · click a row to edit
          </p>
        </div>
        <Link
          href="/admin/items/new"
          className={buttonVariants({ size: "sm" })}
        >
          <Plus className="mr-1 h-4 w-4" />
          New item
        </Link>
      </header>

      <ItemsTable items={items ?? []} />
    </div>
  );
}
