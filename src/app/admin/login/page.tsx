import { redirect } from "next/navigation";

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
    <div className="container mx-auto max-w-md py-12 px-4">
      <AdminLoginForm redirectTo={redirectTo ?? "/admin"} />
    </div>
  );
}
