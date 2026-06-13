import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

import { COOKIE_MAX_AGE, SESSION_COOKIE, deriveToken, verifyToken } from "@/lib/services/auth-gate";

export const prerender = false;

/**
 * Verify a submitted passphrase and, on success, issue the session cookie.
 * The cookie value is the derived token (SHA-256 hex); `verifyToken` does the
 * constant-time compare. Fails closed: any mismatch or missing secret redirects
 * back to the unlock page with an error flag, never granting access.
 */
export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const submitted = form.get("passphrase");
  const passphrase = env.APP_PASSPHRASE;

  if (typeof submitted === "string" && submitted.length > 0) {
    const token = await deriveToken(submitted);
    if (await verifyToken(token, passphrase)) {
      context.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        // Not hardcoded true: a Secure cookie is dropped over http://localhost,
        // which would break local dev and the Playwright e2e. Set on the HTTPS deploy.
        secure: import.meta.env.PROD,
        sameSite: "lax",
        path: "/",
        maxAge: COOKIE_MAX_AGE,
      });
      return context.redirect("/");
    }
  }

  return context.redirect("/unlock?error=1");
};
