/**
 * Thrown by placeholder implementations in this foundation module.
 * Anything that throws this is intentionally unbuilt — a future module
 * replaces it with a real implementation, not a fix for a bug.
 */
export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not implemented yet. This lands in a future module.`);
    this.name = "NotImplementedError";
  }
}
