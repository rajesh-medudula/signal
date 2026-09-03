/**
 * Shared, cross-module types for the multi-tenant shape described in the
 * project architecture. Illustrative only — the production schema
 * (including business/workspace membership) is designed in a later
 * module, and every business-scoped table added then must carry a
 * businessId.
 *
 * Authenticated user identity is defined separately in
 * lib/auth/session.ts (`AuthenticatedUser`) and does not carry a
 * businessId — see docs/architecture.md. There is deliberately no
 * `User` type here: a signed-in user's business/workspace membership
 * is a Module 2B concern, not an authentication concern.
 */

export interface Business {
  id: string;
  name: string;
}
