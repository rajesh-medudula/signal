import { describe, expect, it, vi } from "vitest";

// The real "server-only" package throws when imported outside a React
// Server Component build step; stub it so this Node-environment test
// can still import lib/auth/session.ts.
vi.mock("server-only", () => ({}));

const { getCurrentUser } = await import("@/lib/auth/session");

describe("getCurrentUser", () => {
  it("returns null when there is no session", async () => {
    const client = {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    };

    expect(await getCurrentUser(client)).toBeNull();
  });

  it("returns null when Supabase Auth reports an error", async () => {
    const client = {
      auth: {
        getUser: async () => ({
          data: { user: { id: "user-1", email: "a@example.com" } },
          error: new Error("invalid token"),
        }),
      },
    };

    expect(await getCurrentUser(client)).toBeNull();
  });

  it("returns null when the user has no email", async () => {
    const client = {
      auth: {
        getUser: async () => ({
          data: { user: { id: "user-1", email: null } },
          error: null,
        }),
      },
    };

    expect(await getCurrentUser(client)).toBeNull();
  });

  it("returns only id and email for a valid session — no businessId", async () => {
    const client = {
      auth: {
        getUser: async () => ({
          data: { user: { id: "user-1", email: "a@example.com" } },
          error: null,
        }),
      },
    };

    const user = await getCurrentUser(client);

    expect(user).toEqual({ id: "user-1", email: "a@example.com" });
    expect(user).not.toHaveProperty("businessId");
  });
});
