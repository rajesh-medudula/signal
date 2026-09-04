import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const getMembershipForBusiness = vi.fn();
const getMembershipsForUser = vi.fn();
const cookieGet = vi.fn();

vi.mock("@/lib/business/queries", () => ({
  getMembershipForBusiness: (...args: unknown[]) =>
    getMembershipForBusiness(...args),
  getMembershipsForUser: (...args: unknown[]) => getMembershipsForUser(...args),
}));

vi.mock("@/lib/db/supabase/server", () => ({
  createSupabaseServerClient: async () => ({}),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieGet(name),
  }),
}));

const { resolveActiveBusiness, ACTIVE_BUSINESS_COOKIE } = await import(
  "@/lib/business/context"
);

const user = { id: "user-1", email: "a@example.com" };

const business = (id: string) => ({
  id,
  name: `Business ${id}`,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const membership = (businessId: string, role: "owner" | "admin" | "member" = "owner") => ({
  id: `membership-${businessId}`,
  userId: user.id,
  businessId,
  role,
  createdAt: "2026-01-01T00:00:00.000Z",
  business: business(businessId),
});

beforeEach(() => {
  getMembershipForBusiness.mockReset();
  getMembershipsForUser.mockReset();
  cookieGet.mockReset();
});

describe("resolveActiveBusiness", () => {
  it("uses the cookied business when the user is still a member of it", async () => {
    cookieGet.mockReturnValue({ value: "biz-2" });
    getMembershipForBusiness.mockResolvedValue(membership("biz-2"));

    const result = await resolveActiveBusiness(user);

    expect(result?.business.id).toBe("biz-2");
    expect(getMembershipForBusiness).toHaveBeenCalledWith(
      expect.anything(),
      user.id,
      "biz-2",
    );
  });

  it("falls back to the oldest membership when there is no cookie", async () => {
    cookieGet.mockReturnValue(undefined);
    getMembershipsForUser.mockResolvedValue([
      membership("biz-1"),
      membership("biz-2"),
    ]);

    const result = await resolveActiveBusiness(user);

    expect(result?.business.id).toBe("biz-1");
  });

  it("falls back to the oldest membership when the cookied business is no longer accessible", async () => {
    cookieGet.mockReturnValue({ value: "biz-stale" });
    getMembershipForBusiness.mockResolvedValue(null);
    getMembershipsForUser.mockResolvedValue([membership("biz-1")]);

    const result = await resolveActiveBusiness(user);

    expect(result?.business.id).toBe("biz-1");
  });

  it("returns null when the user has zero memberships", async () => {
    cookieGet.mockReturnValue(undefined);
    getMembershipsForUser.mockResolvedValue([]);

    const result = await resolveActiveBusiness(user);

    expect(result).toBeNull();
  });

  it("reads the cookie under the documented name", () => {
    expect(ACTIVE_BUSINESS_COOKIE).toBe("signal_active_business");
  });
});
