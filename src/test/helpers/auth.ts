import type { BrowserContext } from "@playwright/test";

import { deriveToken, SESSION_COOKIE } from "../../lib/services/auth-gate";

// Passphrase the e2e dev server is configured with. The Playwright webServer
// runs `npm run dev`, which loads APP_PASSPHRASE from `.dev.vars`; this default
// matches that value and is overridable for other environments (e.g. CI).
export const TEST_PASSPHRASE = process.env.E2E_PASSPHRASE ?? "dev-local-passphrase-change-me";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4321";

/**
 * Authenticate past the access gate WITHOUT driving the unlock UI: set the
 * session cookie directly (its value is the derived token, exactly what the
 * server issues). Use this in tests whose risk is the tool itself, so the gate
 * doesn't become repeated UI setup in every spec — the gate's own contract is
 * covered separately in passphrase-gate.e2e.spec.ts.
 */
export async function unlockViaCookie(context: BrowserContext): Promise<void> {
  const token = await deriveToken(TEST_PASSPHRASE);
  await context.addCookies([{ name: SESSION_COOKIE, value: token, url: BASE_URL, httpOnly: true, sameSite: "Lax" }]);
}
