import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type AuthenticatedUser } from "@/lib/auth/session";

/**
 * Resolves the current user or redirects to sign-in — the guard that
 * protected routes (currently the dashboard layout) call at the top of
 * their render. This runs on the server before any protected UI is
 * rendered, so an unauthenticated request never receives dashboard
 * markup to begin with; it isn't a client-side redirect layered on top
 * of content that already shipped.
 */
export async function requireUser(
  redirectTo = "/sign-in",
): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(redirectTo);
  }

  return user;
}
