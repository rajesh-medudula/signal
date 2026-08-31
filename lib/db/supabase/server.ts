import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getRequiredEnv } from "@/lib/security/env";

/**
 * Server-side Supabase instance using the service-role key. The
 * `server-only` import makes it a build error to accidentally import this
 * from a client component. Use lib/db/supabase/client.ts in the browser
 * instead.
 */
export function createSupabaseServerClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}
