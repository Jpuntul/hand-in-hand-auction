import { AdminGuard } from "@/components/auth/admin-guard";

/**
 * Gates every /admin/* page on the admin role. The header + main container
 * live inside each page via <AdminShell> so per-page width can vary.
 */
export default function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminGuard>{children}</AdminGuard>;
}
