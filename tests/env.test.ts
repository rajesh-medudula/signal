import { afterEach, describe, expect, it, vi } from "vitest";
import { getOptionalEnv, getRequiredEnv, isProduction } from "@/lib/security/env";

const TEST_VAR = "SIGNAL_TEST_ENV_VAR";

afterEach(() => {
  delete process.env[TEST_VAR];
});

describe("getRequiredEnv", () => {
  it("returns the value when the variable is set", () => {
    process.env[TEST_VAR] = "example-value";

    expect(getRequiredEnv(TEST_VAR)).toBe("example-value");
  });

  it("throws a clear error when the variable is missing", () => {
    expect(() => getRequiredEnv(TEST_VAR)).toThrowError(
      /Missing required environment variable: SIGNAL_TEST_ENV_VAR/,
    );
  });
});

describe("getOptionalEnv", () => {
  it("returns undefined instead of throwing when unset", () => {
    expect(getOptionalEnv(TEST_VAR)).toBeUndefined();
  });

  it("returns the value when set", () => {
    process.env[TEST_VAR] = "example-value";

    expect(getOptionalEnv(TEST_VAR)).toBe("example-value");
  });
});

describe("isProduction", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isProduction()).toBe(true);
  });

  it("returns false for any other NODE_ENV", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isProduction()).toBe(false);
    vi.stubEnv("NODE_ENV", "test");
    expect(isProduction()).toBe(false);
  });
});
