/**
 * Reads a required environment variable, failing fast with a clear error
 * instead of letting `undefined` silently propagate into a fetch call or
 * client string. Keep this the only place that reads `process.env`
 * directly so env handling stays consistent as more services are added.
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Check .env.example for the full list.`,
    );
  }

  return value;
}

/** Same as getRequiredEnv, but returns undefined instead of throwing. */
export function getOptionalEnv(name: string): string | undefined {
  return process.env[name];
}
