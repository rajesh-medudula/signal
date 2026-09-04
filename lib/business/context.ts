import "server-only";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import type { AuthenticatedUser } from "@/lib/auth/session";
import type { ActiveBusinessContext } from "@/lib/business/types";
import {
  getMembershipForBusiness,
  getMembershipsForUser,
} from "@/lib/business/queries";

/** Cookie holding the user's last-selected business. This is a hint,
 * never proof of access — see `resolveActiveBusiness` below. */
export const ACTIVE_BUSINESS_COOKIE = "signal_active_business";

/**
 * Resolves which business the current request should operate in.
 *
 * The cookie only says which business the user picked last time; it is
 * NOT trusted as proof of membership. Every resolution re-verifies
 * membership through `getMembershipForBusiness`, which goes through the
 * RLS-respecting server client — so even a tampered or stale cookie
 * value can only ever resolve to a business the user actually belongs
 * to, or fail closed.
 *
 * Fails safely (item 32 of the module spec):
 * - no cookie, or the cookied business is no longer accessible
 *   (removed membership, bad value) → falls back to the user's oldest
 *   membership, so there's always a sensible default for anyone who
 *   has at least one business.
 * - zero memberships → returns `null`; callers should send the user to
 *   onboarding.
 */
export async function resolveActiveBusiness(
  user: AuthenticatedUser,
): Promise<ActiveBusinessContext | null> {
  const supabase = await createSupabaseServerClient();
  const cookieStore = await cookies();
  const cookiedBusinessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;

  if (cookiedBusinessId) {
    const membership = await getMembershipForBusiness(
      supabase,
      user.id,
      cookiedBusinessId,
    );

    if (membership) {
      return { business: membership.business, membership };
    }
    // Falls through to the default-membership lookup below — the
    // cookied business is stale, invalid, or no longer accessible.
  }

  const memberships = await getMembershipsForUser(supabase, user.id);
  const [first] = memberships;

  if (!first) {
    return null;
  }

  return { business: first.business, membership: first };
}
