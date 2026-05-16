import Link from "next/link";
import { Gavel } from "lucide-react";

import { AdminGuard } from "@/components/auth/admin-guard";
import { UserMenu } from "@/components/auth/user-menu";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/queries";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // AdminGuard handles the auth/role check. We still resolve the profile
  // here so the header can render the UserMenu in a single render.
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  return (
    <AdminGuard>
      <div className="min-h-full">
        <header className="border-b">
          <div className="container mx-auto flex items-center justify-between px-4 py-3">
            <Link href="/admin" className="flex items-center gap-2">
              <Gavel className="h-5 w-5" />
              <span className="font-semibold">Hand in Hand · Admin</span>
            </Link>
            <UserMenu
              email={user?.email ?? null}
              displayName={profile?.display_name ?? null}
              isAdmin={true}
            />
          </div>
        </header>
        <main>{children}</main>
      </div>
    </AdminGuard>
  );
}
