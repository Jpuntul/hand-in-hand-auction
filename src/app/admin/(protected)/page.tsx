import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            This dashboard will fill in over the next phases of the rewrite:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Phase 3 — item scheduling (start/end times, status, bulk tools)</li>
            <li>Phase 6 — live monitoring, manual overrides, audit log viewer</li>
            <li>Phase 6.5 — promote/revoke admin users</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
