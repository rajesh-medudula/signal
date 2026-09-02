import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRequiredEnv } from "@/lib/security/env";

/**
 * Refreshes the Supabase auth session cookie on every matched request.
 *
 * Server components can read cookies but can't write them, so an
 * expiring access token would never get refreshed if we relied on them
 * alone (see the catch block in `lib/db/supabase/server.ts`). Running
 * this in `proxy.ts` — which can both read and write response cookies —
 * keeps the session alive for the server components and server actions
 * that render after it.
 *
 * This only maintains the session cookie; it does not itself gate
 * access to any route. Route protection lives in
 * `lib/auth/guard.ts`, called from the routes that need it (e.g. the
 * dashboard layout), so the authorization decision stays next to the
 * routes it protects instead of being encoded as URL patterns here.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshing the session requires contacting Supabase Auth, so this
  // call (not getSession(), which only reads local cookie state) is
  // what actually renews an expiring token.
  await supabase.auth.getUser();

  return response;
}
