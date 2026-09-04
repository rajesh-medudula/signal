/**
 * The tenant domain: a business/workspace, and the membership that ties
 * a user to one. Deliberately separate from `AuthenticatedUser`
 * (lib/auth/session.ts) — see docs/architecture.md for why.
 */

export type MembershipRole = "owner" | "admin" | "member";

export interface Business {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  userId: string;
  businessId: string;
  role: MembershipRole;
  createdAt: string;
}

/** A membership plus the business it grants access to, for callers that
 * need both together (e.g. rendering "which businesses can I switch to"). */
export interface MembershipWithBusiness extends Membership {
  business: Business;
}

/** The business a request is currently operating in, plus the caller's
 * membership in it — the return type of `resolveActiveBusiness()`. */
export interface ActiveBusinessContext {
  business: Business;
  membership: Membership;
}
