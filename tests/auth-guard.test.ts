import { describe, expect, it, vi, beforeEach } from "vitest";

// The real "server-only" package throws when imported outside a React
// Server Component build step; stub it so this Node-environment test
// can still import lib/auth/guard.ts.
vi.mock("server-only", () => ({}));

const getCurrentUser = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
}));

// next/navigation's redirect() signals a redirect by throwing a special
// value that the framework catches further up. We reproduce that shape
// here so requireUser's "redirect happened" behavior is testable without
// depending on Next's internals.
class MockRedirect extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new MockRedirect(url);
  },
}));

const { requireUser } = await import("@/lib/auth/guard");

beforeEach(() => {
  getCurrentUser.mockReset();
});

describe("requireUser", () => {
  it("returns the user when one is signed in", async () => {
    const user = { id: "user-1", email: "a@example.com" };
    getCurrentUser.mockResolvedValue(user);

    await expect(requireUser()).resolves.toEqual(user);
  });

  it("redirects to /sign-in by default when there is no user", async () => {
    getCurrentUser.mockResolvedValue(null);

    await expect(requireUser()).rejects.toMatchObject({ url: "/sign-in" });
  });

  it("redirects to a custom path when given one", async () => {
    getCurrentUser.mockResolvedValue(null);

    await expect(requireUser("/custom-sign-in")).rejects.toMatchObject({
      url: "/custom-sign-in",
    });
  });
});
