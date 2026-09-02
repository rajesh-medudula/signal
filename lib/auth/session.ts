import "server-only";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";

/**
 * The authenticated identity for the current request. Deliberately just
 * `id` and `email` — no `businessId`. A user's business/workspace
 * membership is resolved separately (Module 2B), so it can change,
 * multiply, or be re-derived without touching authentication at all.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

type SupabaseAuthClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: unknown;
    }>;
  };
};

/**
 * Resolves the signed-in user for the current request, or `null` if
 * there isn't one.
 *
 * Uses `supabase.auth.getUser()`, not `getSession()`: `getUser()`
 * revalidates the token against Supabase Auth on every call, while a
 * session read from cookies alone can't be trusted to not have been
 * tampered with or already revoked. Every other request-scoped module
 * should go through this function rather than talking to Supabase Auth
 * directly, so this stays the one place that makes that trade-off.
 *
 * Accepts an optional client so callers (and tests) can inject one; by
 * default it creates the real request-scoped server client.
 */
export async function getCurrentUser(
  client?: SupabaseAuthClient,
): Promise<AuthenticatedUser | null> {
  const supabase = client ?? (await createSupabaseServerClient());

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    return null;
  }

  return { id: user.id, email: user.email };
}
