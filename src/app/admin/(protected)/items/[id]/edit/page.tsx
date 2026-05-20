import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { createClient } from "@/lib/supabase/server";
import { ItemForm } from "../../item-form";
import { ItemOverrides } from "../../item-overrides";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!item) notFound();

  return (
    <AdminShell size="default">
      <div className="space-y-6">
        <ItemForm item={item} />
        <ItemOverrides itemId={id} />
      </div>
    </AdminShell>
  );
}
