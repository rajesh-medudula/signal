import { NotImplementedError } from "@/lib/errors";

export interface AuthenticatedUser {
  id: string;
  email: string;
  businessId: string;
}

/**
 * Will read the current session via Supabase Auth once real sign-in is
 * built. The dashboard route group in a future module will use this to
 * redirect signed-out visitors — there's no enforced auth yet, which is
 * why the dashboard in this foundation module is reachable directly.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  throw new NotImplementedError("Authentication");
}
