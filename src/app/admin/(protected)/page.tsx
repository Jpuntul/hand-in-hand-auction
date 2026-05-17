import Link from "next/link";
import { Package2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth/queries";

export default async function AdminDashboardPage() {
  const profile = await getCurrentProfile();

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-8 px-4">
      <header>
        <h1 className="text-3xl font-bold">Admin dashboard</h1>
        <p className="text-muted-foreground">
          Welcome, {profile?.display_name ?? "Admin"}.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/items" className="block">
          <Card className="h-full transition-colors hover:bg-muted/40">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package2 className="h-5 w-5 text-primary" />
                <CardTitle>Items</CardTitle>
              </div>
              <CardDescription>
                Create, schedule, and edit auction items.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Set start/end times, categories, status, and bid increments.
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <ul className="list-disc space-y-1 pl-5">
            <li>Phase 4 — outbid/won/lost notifications</li>
            <li>Phase 6 — live monitoring, manual overrides, audit log viewer</li>
            <li>Phase 6.5 — promote/revoke admin users</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
