import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";

import { SESSION_COOKIE, evaluateGate } from "@/lib/services/auth-gate";

/**
 * Edge access gate. Runs on every request inside the Cloudflare Worker. The
 * whole decision lives in the pure `evaluateGate` (unit-tested); this is thin
 * glue that reads the secret and the session cookie and acts on the verdict.
 *
 * `env.APP_PASSPHRASE` is read at request time (not module scope) per the
 * `cloudflare:workers` contract. A missing secret fails closed: every request
 * is redirected to /unlock, which then rejects every attempt.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const cookieValue = context.cookies.get(SESSION_COOKIE)?.value;
  const verdict = await evaluateGate(context.url.pathname, cookieValue, env.APP_PASSPHRASE);

  if (verdict === "to-unlock") return context.redirect("/unlock");
  if (verdict === "to-home") return context.redirect("/");
  return next();
});
