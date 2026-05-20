import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { AdminToggle } from "./admin-toggle";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = await createClient();

  // Fetch profiles + bid count per user
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const userIds = (profiles ?? []).map((p) => p.id);

  // Bid counts per user
  const { data: bidCounts } = await supabase
    .from("bid_history")
    .select("user_id")
    .in("user_id", userIds);

  const countMap: Record<string, number> = {};
  for (const b of bidCounts ?? []) {
    countMap[b.user_id] = (countMap[b.user_id] ?? 0) + 1;
  }

  return (
    <AdminShell size="wide">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Users
          </h1>
          <p className="text-sm text-muted-foreground">
            {profiles?.length ?? 0} registered accounts. Toggle the switch to
            promote or revoke admin access.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider">
                  Email
                </TableHead>
                <TableHead className="text-center text-xs uppercase tracking-wider">
                  Bids
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider">
                  Joined
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider">
                  Role
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider">
                  Admin
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!profiles?.length ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No users yet.
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((p) => (
                  <TableRow key={p.id} className="border-b border-border/40">
                    <TableCell className="font-medium">
                      {p.display_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {countMap[p.id] ?? 0}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.is_admin ? "default" : "secondary"}>
                        {p.is_admin ? "Admin" : "Bidder"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AdminToggle userId={p.id} isAdmin={p.is_admin} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminShell>
  );
}
