import { afterEach, describe, expect, it, vi } from "vitest";

// The real "server-only" package throws when imported outside a React
// Server Component build step; stub it so these Node-environment tests
// can still import the server-only modules under test.
vi.mock("server-only", () => ({}));

const { createServiceRoleClient } = await import("@/lib/db/supabase/admin");
const { createSupabaseBrowserClient } = await import(
  "@/lib/db/supabase/client"
);

const ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

afterEach(() => {
  for (const name of ENV_VARS) {
    delete process.env[name];
  }
});

describe("createServiceRoleClient", () => {
  it("requires the service-role key, not just the public vars", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";

    expect(() => createServiceRoleClient()).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("constructs once the service-role key is present", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    expect(() => createServiceRoleClient()).not.toThrow();
  });
});

describe("createSupabaseBrowserClient", () => {
  it("requires only the public anon-key vars — never the service-role key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    // Deliberately not set — the browser client must not need it.
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => createSupabaseBrowserClient()).not.toThrow();
  });

  it("throws without the anon key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";

    expect(() => createSupabaseBrowserClient()).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });
});
