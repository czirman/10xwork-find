/**
 * Pure session-token logic for the passphrase access gate. No I/O and no env
 * access — callers pass the passphrase in, so this is safe to unit-test in
 * isolation and shared by the middleware (verify) and the unlock endpoint (issue).
 *
 * The session cookie value is SHA-256(passphrase) in lowercase hex: non-guessable
 * without the passphrase, not reversible, and needs no second signing key. The
 * passphrase entropy is the whole security model — see
 * context/changes/passphrase-access-gate/plan.md (Open Risks).
 */

/** Name of the session cookie set on successful unlock. */
export const SESSION_COOKIE = "session";

/** Session lifetime: 30 days, in seconds. */
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

/** Derive the session token from a passphrase: lowercase hex SHA-256. */
export async function deriveToken(passphrase: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(passphrase));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Constant-time compare of two strings. Returns false on length mismatch and
 * never early-returns on content, so comparison timing doesn't leak the token.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/**
 * Verify a cookie value against the expected token derived from the passphrase.
 * Fails closed: returns false if either input is missing/empty (unset secret,
 * no cookie), so a misconfigured deploy or a guest never gets access by default.
 */
export async function verifyToken(cookieValue: string | undefined, passphrase: string | undefined): Promise<boolean> {
  if (!cookieValue || !passphrase) return false;
  const expected = await deriveToken(passphrase);
  return timingSafeEqual(cookieValue, expected);
}

/** The unlock POST endpoint always bypasses the gate (it issues the cookie). */
const ALLOWLIST_EXACT = new Set(["/api/unlock"]);

/** Path prefixes that bypass the gate: Astro internals and the favicon. */
const ALLOWLIST_PREFIXES = ["/_astro/", "/_image", "/favicon"];

/**
 * Whether a request path bypasses the gate without a session check: the unlock
 * POST endpoint and static assets. These must be reachable while locked, or the
 * unlock page renders unstyled and the POST can never succeed. Checked before
 * any token work, so frequent asset requests never hash the passphrase. Note
 * `/unlock` is deliberately NOT here — it needs the session check (see below).
 */
export function isAllowlisted(pathname: string): boolean {
  if (ALLOWLIST_EXACT.has(pathname)) return true;
  return ALLOWLIST_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Verdict for a request: serve it, send it to the gate, or bounce it home. */
export type GateVerdict = "allow" | "to-unlock" | "to-home";

/**
 * The whole gate decision as a pure function — so all behaviors are unit-tested
 * without mocking Cloudflare/Astro virtual modules; middleware.ts is thin glue.
 *
 * - Allowlisted path (assets, unlock endpoint): allow, no token work.
 * - `/unlock`: show it when locked; bounce an already-unlocked user home (the
 *   redirect lives here, not in .astro frontmatter, which keeps the page purely
 *   presentational and avoids a type-aware-lint crash on frontmatter returns).
 * - Anything else: requires a valid session, else to the unlock page.
 *
 * Fails closed (to-unlock) on a missing secret or cookie.
 */
export async function evaluateGate(
  pathname: string,
  cookieValue: string | undefined,
  passphrase: string | undefined,
): Promise<GateVerdict> {
  if (isAllowlisted(pathname)) return "allow";
  const authed = await verifyToken(cookieValue, passphrase);
  if (pathname === "/unlock") return authed ? "to-home" : "allow";
  return authed ? "allow" : "to-unlock";
}
