import { NotImplementedError } from "@/lib/errors";
import type { AIProvider } from "@/lib/ai/types";

/**
 * Resolves the active AIProvider for the app.
 *
 * Application code should call this instead of importing a vendor SDK
 * directly, so that changing AI providers later means editing this one
 * function rather than every call site. Deliberately unimplemented in this
 * foundation module — no AI calls are made yet.
 */
export function getAIProvider(): AIProvider {
  throw new NotImplementedError("AI provider integration");
}
