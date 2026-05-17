import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ItemForm } from "../../item-form";

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
    <div className="container mx-auto max-w-3xl space-y-6 py-8 px-4">
      <ItemForm item={item} />
    </div>
  );
}
