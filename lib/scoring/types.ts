/**
 * Illustrative shapes only. Real scoring logic, weighting, and persistence
 * are designed in the lead-scoring module, not here.
 */

export type OpportunityPriority = "low" | "medium" | "high";

export interface OpportunityScore {
  conversationId: string;
  priority: OpportunityPriority;
  reason: string;
}
