import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getRequiredEnv } from "@/lib/security/env";

/**
 * Server-side Supabase client for the current request, authenticated as
 * whichever user's session cookie sent the request (if any). Uses the
 * public anon key, so every query still goes through Row Level Security
 * — this is the client normal server components, route handlers, and
 * server actions should reach for.
 *
 * This is deliberately not the same client as
 * `lib/db/supabase/admin.ts`, which holds the service-role key and
 * bypasses RLS. Reach for that one only for genuinely privileged,
 * server-only infrastructure work — never to serve a user's request.
 *
 * Must be called inside a request scope (server component, route
 * handler, or server action) since it reads/writes cookies via
 * `next/headers`.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component that can't set cookies
            // (no response to attach them to). Session refresh for
            // that request is instead handled by proxy.ts (via
            // lib/db/supabase/middleware.ts). Safe to ignore here.
          }
        },
      },
    },
  );
}
