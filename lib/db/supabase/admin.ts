import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getRequiredEnv } from "@/lib/security/env";

/**
 * Privileged Supabase instance authenticated with the service-role key.
 * This key bypasses Row Level Security entirely, so this client must
 * never be used to serve an ordinary authenticated user's request.
 *
 * Reserve it for trusted, server-only infrastructure code that
 * genuinely needs unrestricted access — background jobs, ingestion
 * pipelines, admin tooling. Anything that acts on behalf of a signed-in
 * user belongs in `lib/db/supabase/server.ts` instead, which respects
 * RLS via the user's own session.
 *
 * The `server-only` import makes it a build error to accidentally pull
 * this into client code, and the explicit name is meant to make misuse
 * hard to do by accident at a call site.
 */
export function createServiceRoleClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
