/**
 * Application code should depend only on these types, never on a specific
 * AI vendor's SDK. A future module implements one AIProvider per vendor
 * (see provider.ts) so the provider can change without touching callers.
 */

export type AIRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIRole;
  content: string;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  /** Free-form hint for provider-specific tuning, e.g. "intent-detection". */
  task?: string;
}

export interface AICompletionResult {
  content: string;
  /** Which provider/model actually served the request, for logging and cost tracking. */
  model: string;
}

/**
 * The contract every AI provider adapter must satisfy. Nothing in this
 * module implements it yet — that begins once real AI features are built.
 */
export interface AIProvider {
  readonly name: string;
  complete(request: AICompletionRequest): Promise<AICompletionResult>;
}
