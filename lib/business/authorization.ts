import "server-only";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { getMembershipForBusiness } from "@/lib/business/queries";
import { resolveActiveBusiness } from "@/lib/business/context";
import type { ActiveBusinessContext } from "@/lib/business/types";

/**
 * Resolves the business context a protected request should operate in,
 * verifying access every time — this is the one path future modules
 * should use to answer "which business is this request operating in?"
 * rather than each inventing its own `getBusinessId()`.
 *
 * - No `businessId` given: resolves the caller's active business
 *   (`resolveActiveBusiness`). Redirects to `/onboarding` if they have
 *   none.
 * - `businessId` given: verifies the *authenticated* caller is actually
 *   a member of that specific business before returning anything. This
 *   is the check that matters when a request names a business
 *   explicitly (a URL param, a form field) — that identifier is never
 *   trusted on its own, only ever used to look up a membership row
 *   scoped to `(select auth.uid())`. A non-member gets `notFound()`
 *   rather than a 403, so a stranger can't use the response to learn
 *   whether a given business ID even exists.
 */
export async function requireBusinessAccess(
  businessId?: string,
): Promise<ActiveBusinessContext> {
  const user = await requireUser();

  if (!businessId) {
    const context = await resolveActiveBusiness(user);
    if (!context) {
      redirect("/onboarding");
    }
    return context;
  }

  const supabase = await createSupabaseServerClient();
  const membership = await getMembershipForBusiness(
    supabase,
    user.id,
    businessId,
  );

  if (!membership) {
    notFound();
  }

  return { business: membership.business, membership };
}

/**
 * Same as `requireBusinessAccess`, but additionally requires the
 * caller's role in that business to be `owner` or `admin`. A member
 * with plain access gets the same `notFound()` treatment as a
 * non-member — from a member's perspective, an admin-only action
 * simply doesn't exist for them, not "exists but you're forbidden",
 * which would leak the shape of the admin surface unnecessarily.
 */
export async function requireBusinessAdmin(
  businessId?: string,
): Promise<ActiveBusinessContext> {
  const context = await requireBusinessAccess(businessId);

  if (context.membership.role !== "owner" && context.membership.role !== "admin") {
    notFound();
  }

  return context;
}
