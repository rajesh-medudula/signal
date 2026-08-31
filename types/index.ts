/**
 * Shared, cross-module types for the multi-tenant shape described in the
 * project architecture (User -> Business -> Business Data). Illustrative
 * only — the production schema is designed in a later module, and every
 * business-scoped table added then must carry a businessId.
 */

export interface Business {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  businessId: string;
}
