import { SiteShell, type SiteShellSize } from "@/components/site-shell";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/queries";

/**
 * SiteShell variant for protected admin pages.
 *
 * Encapsulates the user fetch and brand label so each admin page can just
 * pick its content width and write the body — without repeating the header
 * scaffold. AdminGuard already gates this layer, so we can trust profile
 * is non-null here.
 */
export async function AdminShell({
  size = "wide",
  children,
}: {
  size?: SiteShellSize;
  children: React.ReactNode;
}) {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  return (
    <SiteShell
      size={size}
      brand="Hand in Hand · Admin"
      user={{
        email: user?.email ?? null,
        displayName: profile?.display_name ?? null,
        isAdmin: true,
      }}
    >
      {children}
    </SiteShell>
  );
}
