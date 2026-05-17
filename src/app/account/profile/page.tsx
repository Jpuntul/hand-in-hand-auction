import { redirect } from "next/navigation";

import { SiteShell } from "@/components/site-shell";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/queries";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);
  if (!user) redirect("/login");

  return (
    <SiteShell
      size="narrow"
      user={{
        email: user.email ?? null,
        displayName: profile?.display_name ?? null,
        isAdmin: profile?.is_admin ?? false,
      }}
    >
      <div className="space-y-6">
        <section>
          <h1 className="text-2xl font-bold sm:text-3xl">Profile</h1>
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
    </SiteShell>
  );
}
