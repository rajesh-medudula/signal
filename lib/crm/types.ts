/**
 * Illustrative shapes only. The production database schema — including
 * how customers are keyed, deduplicated across channels, and scoped to a
 * business — is designed in the CRM module, not here.
 */

export interface Customer {
  id: string;
  businessId: string;
  displayName: string;
  primaryChannel: string;
}

export interface CustomerSummary {
  customerId: string;
  summary: string;
  lastUpdated: string;
}
