# Passphrase Access Gate Implementation Plan

## Overview

Gate the publicly-deployed app behind a single shared passphrase, checked at the edge by Astro middleware running on the Cloudflare Worker. An unauthenticated request is redirected to an `/unlock` page; submitting the correct passphrase sets a 30-day, HttpOnly, signed-like session cookie and lands the user in the tool. No server-side user records, no identity provider — the passphrase is the sole credential, and all skill/posting data stays on-device exactly as before.

This is roadmap slice **S-03** (roadmap v2), tracing to PRD v2 **FR-009** and the amended **Access Control** section.

## Current State Analysis

- **Astro 6 SSR** (`output: "server"` in `astro.config.mjs`) on the **Cloudflare adapter** (`@astrojs/cloudflare` 13.5.0). Server code runs inside the Worker, so middleware executes at the edge on every request — the correct place for the gate.
- **No middleware exists** — `src/middleware.ts` is absent. Clean insertion point; nothing to refactor or neutralize (the old Supabase auth module was already fully removed: no auth files, no `@supabase/*` deps, no API routes).
- **One page**: `src/pages/index.astro` renders the `SkillsTool.tsx` React island. There are no API routes yet (`src/pages/api/` does not exist) — the unlock POST handler will be the first.
- **Cloudflare env access**: secrets/vars are reachable in SSR via `context.locals.runtime.env` (the `@astrojs/cloudflare` convention). Local dev reads from a `.dev.vars` file.
- **Web Crypto** (`crypto.subtle`) is available in the Workers runtime and in Node 22 dev — used for the SHA-256 token; no third-party crypto dependency needed.
- **Test tooling present**: Vitest (`npm run test:run`) + Playwright (`@playwright/test`).
- The app is **currently live and world-open** at `https://10xwork-find.service-mak.workers.dev` — this plan closes that exposure.

## Desired End State

Visiting any route on the deployed app without a valid session cookie shows the unlock page. Entering the correct passphrase grants access for 30 days (cookie-backed); an incorrect passphrase shows an inline error and stays on the unlock page. The tool itself is unchanged once unlocked, and no skill or posting data leaves the device. Verifiable by: the Playwright e2e flow passing, and a manual check on the live URL after the Cloudflare secret is set.

### Key Discoveries:

- Astro middleware signature: `export const onRequest = defineMiddleware((context, next) => …)` in `src/middleware.ts`, auto-discovered by Astro. (`astro.config.mjs:8` confirms SSR + Cloudflare adapter.)
- Env in SSR: `context.locals.runtime.env.APP_PASSPHRASE` under the Cloudflare adapter; type it by extending `App.Locals` / `Astro.locals` in `src/env.d.ts`.
- Cookies: Astro exposes `context.cookies.get/set` with `httpOnly`, `secure`, `sameSite`, `maxAge`, `path` options — no manual `Set-Cookie` string building.
- Static assets and Astro internals must be allowlisted so the gate doesn't break its own unlock page styling (paths under `/_astro/`, `/_image`, `favicon`, etc.).

## What We're NOT Doing

- **No per-user accounts / multi-tenancy / Supabase** — explicitly out of scope per PRD v2 Non-Goals. Single shared passphrase only.
- **No rate-limiting / brute-force lockout infrastructure** (no KV, no Durable Objects) — KISS for v1; accepted risk recorded below. Mitigated by a strong passphrase + constant-time compare.
- **No dedicated logout route** — the 30-day cookie expiry handles session end; logout is a trivial future add (clear the cookie).
- **No password-strength UI, no "remember me" toggle, no email/recovery** — there is one passphrase, set as a deploy secret.
- **No change to the tool's behavior or its on-device storage** — the gate wraps the existing app, it does not touch `SkillsTool.tsx`.

## Implementation Approach

A pure verification module computes a session token = `SHA-256(passphrase)` (hex). Middleware reads the expected token from the passphrase env var, reads the `session` cookie, and constant-time-compares them: match → `next()`; mismatch → redirect to `/unlock` (unless the request is already for the unlock page, its POST handler, or a static asset). The `/unlock` page is a server-rendered Astro form posting to `/api/unlock`, which verifies the submitted passphrase, sets the cookie on success, and redirects home; on failure it re-renders the unlock page with an error. One secret, one hash, no second signing key.

## Critical Implementation Details

- **Constant-time compare**: do not use `===` on the token/cookie. Compare via a constant-time routine (equal-length byte comparison that does not early-return) so a network attacker can't time-slice the token. The token is fixed-length hex (64 chars), which makes constant-time comparison straightforward.
- **Allowlist ordering in middleware**: the unlock page (`/unlock`), the unlock endpoint (`/api/unlock`), and static assets (`/_astro/`, `/_image`, `/favicon*`) must bypass the gate, or the unlock page renders unstyled and the POST can never succeed (redirect loop). Check the allowlist before the cookie check.
- **Cookie attributes**: `httpOnly: true`, `secure: import.meta.env.PROD`, `sameSite: "lax"`, `path: "/"`, `maxAge: 60*60*24*30`. Do **not** hardcode `secure: true`: a `Secure` cookie is browser-restricted over `http://localhost`, and Playwright's Chromium against `astro dev`/`preview` (HTTP) may silently drop it — which would make Phase 2 manual checks and the Phase 3 e2e fail like a logic bug when the logic is fine. Gating `secure` on `PROD` keeps it set on the HTTPS deploy and lets it work locally.
- **`.dev.vars` → `runtime.env` requires `platformProxy` in dev**: `context.locals.runtime.env.APP_PASSPHRASE` is only populated in `astro dev` when the Cloudflare adapter's `platformProxy` is active. `astro.config.mjs` currently calls `cloudflare()` with no options. **Confirm this before writing the middleware** — if platformProxy is not on by default in `@astrojs/cloudflare` 13.5.0, enable it (`cloudflare({ platformProxy: { enabled: true } })`); otherwise the passphrase reads `undefined` in dev and the fail-closed logic locks you out of your own local app. This is the single most likely thing to derail implementation.
- **Missing env var**: if the passphrase env var is unset (misconfigured deploy), middleware must **fail closed** — treat every request as unauthenticated and redirect to `/unlock` (which will also reject every attempt), never fail open to grant access.

## Phase 1: Verification core + env wiring

### Overview

A dependency-free, unit-testable verification module plus the env/typing wiring it needs. No request handling yet.

### Changes Required:

#### 0. Confirm dev env wiring (do this first)

**File**: `astro.config.mjs` (verify, edit only if needed)

**Intent**: Before writing any gate code, confirm `.dev.vars` actually reaches `context.locals.runtime.env` under `astro dev` — otherwise the passphrase is `undefined` in dev and the fail-closed gate locks you out locally.

**Contract**: Verify the Cloudflare adapter's `platformProxy` is active in dev (it is the mechanism that surfaces `.dev.vars`). If not on by default in `@astrojs/cloudflare` 13.5.0, set `cloudflare({ platformProxy: { enabled: true } })`. A 30-second smoke test (log `runtime.env.APP_PASSPHRASE` in a throwaway endpoint, or check via the existing patterns) confirms it before the middleware depends on it.

#### 1. Session token + verification module

**File**: `src/lib/services/auth-gate.ts` (new)

**Intent**: Provide the pure functions the middleware and unlock endpoint both depend on: derive the session token from the passphrase, and constant-time-verify a cookie value against it. Centralizing this keeps the crypto in one tested place.

**Contract**: Exposes async `deriveToken(passphrase: string): Promise<string>` (returns lowercase hex SHA-256 via `crypto.subtle.digest`) and `verifyToken(cookieValue: string | undefined, passphrase: string | undefined): Promise<boolean>` (returns `false` if either input is missing/empty — fail closed — else constant-time-compares `cookieValue` to `deriveToken(passphrase)`). Also export the cookie name constant (`SESSION_COOKIE = "session"`) and `COOKIE_MAX_AGE`.

```ts
// constant-time compare of two equal-length hex strings; no early return
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
```

#### 2. Env var typing + local dev secret

**File**: `src/env.d.ts` (extend), `.dev.vars` (new, git-ignored), `.dev.vars.example` (new, committed)

**Intent**: Make `APP_PASSPHRASE` type-safe where the Cloudflare adapter exposes it, and give local dev a passphrase without committing the real one.

**Contract**: In `src/env.d.ts`, declare the Cloudflare runtime env shape so `context.locals.runtime.env.APP_PASSPHRASE` is typed as `string`. `.dev.vars` contains `APP_PASSPHRASE=<dev value>` and is added to `.gitignore`. `.dev.vars.example` documents the key with a placeholder. (Per Cloudflare/`@astrojs/cloudflare` convention `.dev.vars` is the local secret source.)

#### 3. Git-ignore the dev secret

**File**: `.gitignore` (extend)

**Intent**: Never commit the real local passphrase.

**Contract**: Add `.dev.vars` (keep `.dev.vars.example` tracked).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build` (or `astro check`)
- Linting passes: `npm run lint`
- Unit tests for `deriveToken` / `verifyToken` pass: `npm run test:run` (stable hex output for a known input; `verifyToken` returns `false` for missing cookie, missing passphrase, and wrong value; `true` for the matching token)

#### Manual Verification:

- `.dev.vars` exists locally with a chosen dev passphrase and is git-ignored (`git status` shows it untracked/ignored)

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Middleware gate + unlock flow

### Overview

Wire the verification module into request handling: the edge gate, the unlock page, and the verify endpoint.

### Changes Required:

#### 1. Edge gate middleware

**File**: `src/middleware.ts` (new)

**Intent**: Intercept every request, allow the unlock page / endpoint / static assets, and for everything else require a valid session cookie — redirecting to `/unlock` when absent or invalid. Fail closed if the passphrase env var is missing.

**Contract**: `export const onRequest = defineMiddleware(async (context, next) => …)`. Reads `context.locals.runtime.env.APP_PASSPHRASE` and `context.cookies.get(SESSION_COOKIE)?.value`; calls `verifyToken`. Allowlist (checked first): exact `/unlock`, exact `/api/unlock`, and prefix matches for static assets (`/_astro/`, `/_image`, `/favicon`). On invalid session for a non-allowlisted path: `return context.redirect("/unlock")`. On valid: `return next()`.

#### 2. Unlock page

**File**: `src/pages/unlock.astro` (new)

**Intent**: Server-rendered passphrase prompt — a plain HTML form, no React island, works without client JS. Reuses the existing `Layout.astro` and Tailwind/shadcn styling for visual consistency.

**Contract**: Renders a `<form method="POST" action="/api/unlock">` with a single `type="password"` field named `passphrase` and a submit button. Reads an optional `?error=1` query param (set by the endpoint on failure) to render an inline error message. If the visitor already has a valid session, redirect to `/` (avoid showing the gate to an unlocked user). Polish language to match `index.astro`.

#### 3. Unlock verify endpoint

**File**: `src/pages/api/unlock.ts` (new)

**Intent**: Verify the submitted passphrase, set the session cookie on success, redirect appropriately. First API route in the project.

**Contract**: `export const prerender = false;` and `export const POST: APIRoute = async (context) => …`. Reads `passphrase` from the posted form data, compares `deriveToken(submitted)` against `deriveToken(env.APP_PASSPHRASE)` (or equivalently verifies via the module). On success: `context.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: import.meta.env.PROD, sameSite: "lax", path: "/", maxAge: COOKIE_MAX_AGE })` then `return context.redirect("/")`. On failure: `return context.redirect("/unlock?error=1")`. Fail closed if env var missing.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`
- Middleware unit tests pass: `npm run test:run` — with a mocked context, an unauthenticated request to `/` redirects to `/unlock`; `/unlock`, `/api/unlock`, and `/_astro/x.css` are allowed through; a request carrying a valid cookie is allowed through; a missing passphrase env redirects (fail closed)

#### Manual Verification:

- `npm run dev`, visit `/` → redirected to `/unlock`
- Submit wrong passphrase → stays on `/unlock` with an inline error
- Submit correct passphrase → lands on `/` with the tool; the `session` cookie is HttpOnly (visible in devtools as HttpOnly)
- After unlocking, reload `/` → no redirect (cookie honored); the SkillsTool still works (add a skill, paste a posting) — no regression

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Tests + secret/deploy

### Overview

Lock the behavior with an end-to-end test and ship the secret to production, then verify the live gate.

### Changes Required:

#### 1. E2E gate flow test

**File**: `e2e/passphrase-gate.spec.ts` (new — or the project's existing Playwright test dir if different)

**Intent**: Prove the user-visible contract end-to-end against the running app, independent of internal implementation.

**Contract**: A self-contained spec (own setup/teardown, role/label-based locators per the project's E2E rules, no `waitForTimeout`): (a) fresh context visiting `/` is redirected to the unlock page; (b) entering a wrong passphrase shows the error and does not reach the tool; (c) entering the correct passphrase (from the test env passphrase) reaches the tool (assert a known tool element is visible); (d) the session persists across a reload. Uses a known test passphrase via env, not a hard-coded production value.

#### 2. Production secret + docs

**File**: `README.md` / `CLAUDE.md` deployment note (extend), plus the `wrangler secret put` operation (no file — an operational step)

**Intent**: Set the real passphrase as a Cloudflare Worker secret and document the one-time setup so the deploy isn't misconfigured (which would fail closed and lock everyone out).

**Contract**: Run `npx wrangler secret put APP_PASSPHRASE` (operational, performed by the user — interactive prompt). **Requirement, not a suggestion:** the value must be a generated high-entropy secret (e.g. 24+ random chars / a passphrase generator), not a memorable word — since with no rate-limiting and an unsalted cookie hash, passphrase entropy is the entire security model (see Open Risks). Document in the deploy section: the secret name, that local dev uses `.dev.vars`, and that a missing secret fails closed. CI auto-deploys on push to `main`; the secret is set out-of-band once.

### Success Criteria:

#### Automated Verification:

- Full unit suite passes: `npm run test:run`
- Lint + build pass: `npm run lint && npm run build`
- Playwright e2e passes locally against `npm run preview` (or dev): `npx playwright test passphrase-gate`

#### Manual Verification:

- After `wrangler secret put APP_PASSPHRASE` and deploy, visiting the live URL in a fresh/incognito session shows the unlock page (no access without the passphrase)
- Correct passphrase on the live URL grants access; the tool works end-to-end
- Wrong passphrase on the live URL is rejected

**Implementation Note**: This is the final phase — after automated + manual verification, the slice is ready for impl-review / archive.

---

## Testing Strategy

### Unit Tests:

- `deriveToken`: deterministic hex for a known input; differs for different inputs.
- `verifyToken`: `true` only for the exact matching token; `false` for missing cookie, missing passphrase, wrong value, and length mismatch.
- Middleware: redirect-to-`/unlock` for unauthenticated non-allowlisted paths; pass-through for allowlisted paths and valid-cookie requests; fail-closed on missing env.

### Integration Tests:

- The `/api/unlock` POST → cookie-set → redirect path, exercised via the e2e flow (covers form parsing, cookie attributes, redirect).

### Manual Testing Steps:

1. `npm run dev`, hit `/`, confirm redirect to `/unlock`.
2. Wrong passphrase → inline error, no access.
3. Correct passphrase → tool loads; reload stays unlocked.
4. Confirm `session` cookie is HttpOnly + (on HTTPS) Secure.
5. On the live URL after secret set: incognito → gated; correct passphrase → in.

## Performance Considerations

Negligible: one SHA-256 digest of a short string per request, at the edge. No I/O, no DB, no external calls. The gate adds sub-millisecond overhead to requests.

## Migration Notes

No data migration. The cookie is new; existing users (the single owner) simply see the unlock page once and enter the passphrase. The one operational prerequisite is setting `APP_PASSPHRASE` as a Worker secret before/with the deploy — until it is set, the app fails closed (everyone is gated out), so set it in the same change window as the deploy.

## References

- Roadmap slice: `context/foundation/roadmap.md` → S-03 (`passphrase-access-gate`)
- PRD: `context/foundation/prd.md` → FR-009, Access Control (v2)
- Astro config (SSR + Cloudflare adapter): `astro.config.mjs:8`
- Shipped tool the gate wraps: `src/pages/index.astro`, `src/components/SkillsTool.tsx`

## Open Risks & Assumptions

- **Brute-force on a public URL (accepted):** with no rate-limiting, online brute force is bounded _solely_ by passphrase entropy — constant-time compare addresses timing attacks, not guessing. And because the cookie is unsalted `SHA-256(passphrase)`, offline cracking of a leaked cookie is _also_ bounded solely by passphrase entropy. This is a fine KISS posture, but it means **the passphrase is the entire security model**, not a nice-to-have. Hence the hard requirement in Phase 3: a generated high-entropy secret, not a memorable word. If exposure proves real, a KV-backed attempt counter is the v2 follow-up.
- **Assumption — single shared passphrase is acceptable** per PRD v2; if the owner later wants real accounts, that's a separate PRD change (parked: account-based auth).
- **Misconfigured secret fails closed**, locking the owner out until `APP_PASSPHRASE` is set — intentional (never fail open). Called out in Migration Notes.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Verification core + env wiring

#### Automated

- [ ] 1.1 Type checking passes: `npm run build`
- [ ] 1.2 Linting passes: `npm run lint`
- [ ] 1.3 Unit tests for `deriveToken` / `verifyToken` pass: `npm run test:run`

#### Manual

- [ ] 1.4 `.dev.vars` exists locally with a dev passphrase and is git-ignored

### Phase 2: Middleware gate + unlock flow

#### Automated

- [ ] 2.1 Type checking passes: `npm run build`
- [ ] 2.2 Linting passes: `npm run lint`
- [ ] 2.3 Middleware unit tests pass: `npm run test:run`

#### Manual

- [ ] 2.4 `/` redirects to `/unlock` in dev
- [ ] 2.5 Wrong passphrase → inline error, no access
- [ ] 2.6 Correct passphrase → tool loads; cookie is HttpOnly
- [ ] 2.7 Reload after unlock stays unlocked; SkillsTool works (no regression)

### Phase 3: Tests + secret/deploy

#### Automated

- [ ] 3.1 Full unit suite passes: `npm run test:run`
- [ ] 3.2 Lint + build pass: `npm run lint && npm run build`
- [ ] 3.3 Playwright e2e passes: `npx playwright test passphrase-gate`

#### Manual

- [ ] 3.4 Live URL in a fresh session shows the unlock page
- [ ] 3.5 Correct passphrase on live URL grants access; tool works
- [ ] 3.6 Wrong passphrase on live URL is rejected
