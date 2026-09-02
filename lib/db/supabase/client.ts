import { createBrowserClient } from "@supabase/ssr";
import { getRequiredEnv } from "@/lib/security/env";

/**
 * Client-side Supabase instance. Only ever constructed from the
 * NEXT_PUBLIC_* variables, which are safe to ship to the browser. Never
 * import lib/db/supabase/server.ts or lib/db/supabase/admin.ts (service
 * role) from client code.
 *
 * Uses `@supabase/ssr` rather than the base `@supabase/supabase-js`
 * client so the session is stored in cookies instead of localStorage —
 * that's what lets server components and route handlers see the same
 * session the browser has.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}
