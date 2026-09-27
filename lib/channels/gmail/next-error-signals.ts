/**
 * True only for the notFound()/forbidden()/unauthorized() family of
 * Next.js control-flow signals (they share this digest prefix as of
 * the Next version this repo pins) — never for redirect(), whose
 * digest starts with `NEXT_REDIRECT` instead.
 *
 * Why the Gmail callback route needs this at all: a thrown
 * `redirect()` carries forward any cookie mutations made earlier in
 * the same request/response cycle (verified empirically against the
 * pinned Next version — see the Module 4 completion report), but a
 * thrown `notFound()` does not. The callback route uses this to give
 * `requireBusinessAdmin()`'s own `notFound()` (a lost/never-held admin
 * role) the same cookie-clearing treatment as every other failure
 * exit, without reimplementing any authorization logic — the
 * authorization *decision* stays entirely `requireBusinessAdmin()`'s;
 * this only changes how its already-decided failure is turned into a
 * response.
 *
 * This is coupled to Next's internal error-signal format on purpose.
 * If a future Next upgrade changes it, the safe fallback is that this
 * function simply stops returning true for that signal and
 * `requireBusinessAdmin()`'s notFound() takes over again directly — a
 * regression to the previous, still-correct-but-cookie-leaking
 * behavior, never a security issue: the authorization check itself is
 * untouched either way.
 */
export function isNextNotFoundSignal(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")
  );
}
