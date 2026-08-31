import { createClient } from "@supabase/supabase-js";
import { getRequiredEnv } from "@/lib/security/env";

/**
 * Client-side Supabase instance. Only ever constructed from the
 * NEXT_PUBLIC_* variables, which are safe to ship to the browser. Never
 * import lib/db/supabase/server.ts (service-role key) from client code.
 */
export function createSupabaseBrowserClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}
