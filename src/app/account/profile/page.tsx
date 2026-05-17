import Link from "next/link";
import { redirect } from "next/navigation";
import { Gavel } from "lucide-react";

import { UserMenu } from "@/components/auth/user-menu";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/queries";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);
  if (!user) redirect("/login");

  return (
    <div className="container mx-auto max-w-md space-y-6 py-8 px-4">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Gavel className="h-6 w-6" />
          <span className="text-xl font-semibold">Hand in Hand</span>
        </Link>
        <UserMenu
          email={user.email ?? null}
          displayName={profile?.display_name ?? null}
          isAdmin={profile?.is_admin ?? false}
        />
      </header>

      <section>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your account details and contact info.
        </p>
      </section>

      <ProfileForm
        email={user.email ?? null}
        isAdmin={profile?.is_admin ?? false}
        createdAt={user.created_at}
        displayName={profile?.display_name ?? ""}
        phone={profile?.phone ?? ""}
      />
    </div>
  );
}
