import { AdminShell } from "@/components/admin/admin-shell";
import { ItemForm } from "../item-form";

export default function NewItemPage() {
  return (
    <AdminShell size="default">
      <ItemForm />
    </AdminShell>
  );
}
