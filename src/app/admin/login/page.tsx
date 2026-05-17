import { redirect } from "next/navigation";

import { SiteShell } from "@/components/site-shell";
import { getCurrentProfile } from "@/lib/auth/queries";
import { AdminLoginForm } from "./admin-login-form";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const [profile, { redirect: redirectTo }] = await Promise.all([
    getCurrentProfile(),
    searchParams,
  ]);

  if (profile?.is_admin) {
    redirect(redirectTo ?? "/admin");
  }

  return (
    <SiteShell size="narrow" user={null} brand="Hand in Hand · Admin">
      <AdminLoginForm redirectTo={redirectTo ?? "/admin"} />
    </SiteShell>
  );
}
