import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const requireUser = vi.fn();
const resolveActiveBusiness = vi.fn();
const getMembershipForBusiness = vi.fn();

vi.mock("@/lib/auth/guard", () => ({
  requireUser: (...args: unknown[]) => requireUser(...args),
}));

vi.mock("@/lib/business/context", () => ({
  resolveActiveBusiness: (...args: unknown[]) => resolveActiveBusiness(...args),
}));

vi.mock("@/lib/business/queries", () => ({
  getMembershipForBusiness: (...args: unknown[]) =>
    getMembershipForBusiness(...args),
}));

vi.mock("@/lib/db/supabase/server", () => ({
  createSupabaseServerClient: async () => ({}),
}));

class MockRedirect extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}
class MockNotFound extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new MockRedirect(url);
  },
  notFound: () => {
    throw new MockNotFound();
  },
}));

const { requireBusinessAccess, requireBusinessAdmin } = await import(
  "@/lib/business/authorization"
);

const user = { id: "user-1", email: "a@example.com" };

const business = { id: "biz-1", name: "Acme", createdAt: "", updatedAt: "" };

const membershipWithRole = (role: "owner" | "admin" | "member") => ({
  id: "m-1",
  userId: user.id,
  businessId: business.id,
  role,
  business,
});

beforeEach(() => {
  requireUser.mockReset();
  resolveActiveBusiness.mockReset();
  getMembershipForBusiness.mockReset();
  requireUser.mockResolvedValue(user);
});

describe("requireBusinessAccess", () => {
  it("with no businessId, returns the caller's active business", async () => {
    resolveActiveBusiness.mockResolvedValue({
      business,
      membership: membershipWithRole("owner"),
    });

    const result = await requireBusinessAccess();

    expect(result.business.id).toBe("biz-1");
  });

  it("with no businessId and no active business, redirects to /onboarding", async () => {
    resolveActiveBusiness.mockResolvedValue(null);

    await expect(requireBusinessAccess()).rejects.toMatchObject({
      url: "/onboarding",
    });
  });

  it("with an explicit businessId, verifies membership directly rather than trusting it", async () => {
    getMembershipForBusiness.mockResolvedValue({
      ...membershipWithRole("member"),
      business,
    });

    const result = await requireBusinessAccess("biz-1");

    expect(getMembershipForBusiness).toHaveBeenCalledWith(
      expect.anything(),
      user.id,
      "biz-1",
    );
    expect(result.business.id).toBe("biz-1");
  });

  it("with an explicit businessId the caller isn't a member of, returns 404 (not 403)", async () => {
    getMembershipForBusiness.mockResolvedValue(null);

    await expect(requireBusinessAccess("someone-elses-biz")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});

describe("requireBusinessAdmin", () => {
  it("allows an owner", async () => {
    resolveActiveBusiness.mockResolvedValue({
      business,
      membership: membershipWithRole("owner"),
    });

    await expect(requireBusinessAdmin()).resolves.toMatchObject({
      membership: { role: "owner" },
    });
  });

  it("allows an admin", async () => {
    resolveActiveBusiness.mockResolvedValue({
      business,
      membership: membershipWithRole("admin"),
    });

    await expect(requireBusinessAdmin()).resolves.toMatchObject({
      membership: { role: "admin" },
    });
  });

  it("denies a plain member with 404, not a distinguishing 403", async () => {
    resolveActiveBusiness.mockResolvedValue({
      business,
      membership: membershipWithRole("member"),
    });

    await expect(requireBusinessAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
