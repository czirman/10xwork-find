# Passphrase Access Gate — Plan Brief

> Full plan: `context/changes/passphrase-access-gate/plan.md`

## What & Why

The app is deployed at a public Cloudflare URL and is currently open to anyone. This adds a single shared-passphrase gate at the edge so only the owner can use it — satisfying PRD v2 FR-009 / Access Control while keeping all skill and posting data on-device (no accounts, no server-side identity).

## Starting Point

Astro 6 SSR on the Cloudflare adapter, no middleware yet, one page (`index.astro` → `SkillsTool.tsx`), no API routes, no auth code (the old Supabase module was fully removed). Vitest + Playwright are already set up. The live deploy is world-open today.

## Desired End State

Any route, visited without a valid session cookie, shows an unlock page. The correct passphrase sets a 30-day HttpOnly cookie and lands the user in the unchanged tool; a wrong passphrase shows an inline error. Nothing about the tool's on-device behavior changes.

## Key Decisions Made

| Decision             | Choice                                                           | Why (1 sentence)                                                        | Source |
| -------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ |
| Enforcement layer    | Astro middleware (`src/middleware.ts`) on the Worker             | In-repo, versioned, testable; no IdP or Cloudflare-dashboard dependency | Plan   |
| Credential storage   | `APP_PASSPHRASE` env var / Worker secret; `.dev.vars` locally    | One secret, no DB, keeps "data stays local" intact                      | Plan   |
| Session cookie       | `SHA-256(passphrase)` hex, HttpOnly+Secure+SameSite=Lax, 30 days | "Signed-like", non-guessable, no second key, no complex crypto          | Plan   |
| Unlock UX            | Server-rendered Astro form, no React island                      | Works without client JS; KISS                                           | Plan   |
| Brute-force handling | None (constant-time compare + strong passphrase)                 | KISS for v1; exposure recorded as accepted Open Risk                    | Plan   |
| Logout               | Out of scope (cookie expiry handles it)                          | Trivial future add; not needed for single owner                         | Plan   |

## Scope

**In scope:** edge middleware gate; `/unlock` page + `/api/unlock` verify endpoint; signed-like 30-day cookie; env/typing + `.dev.vars`; unit + e2e tests; Worker secret + deploy verification.

**Out of scope:** accounts/multi-tenancy/Supabase, rate-limiting infra, logout route, password-strength/recovery UI, any change to the tool itself.

## Architecture / Approach

A pure module derives `token = SHA-256(passphrase)` and constant-time-verifies a cookie against it. Middleware allowlists the unlock page, its POST handler, and static assets, then gates everything else on the cookie — redirecting to `/unlock` when missing/invalid, and failing **closed** if the passphrase env var is unset. `/unlock` posts to `/api/unlock`, which verifies, sets the cookie, and redirects home.

## Phases at a Glance

| Phase                       | What it delivers                                   | Key risk                                              |
| --------------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| 1. Verification core + env  | Tested token/verify module; typed env; `.dev.vars` | Constant-time compare correctness                     |
| 2. Middleware gate + unlock | Edge gate, unlock page, verify endpoint            | Allowlist gaps → redirect loop / unstyled unlock page |
| 3. Tests + secret/deploy    | E2E flow; Worker secret set; live verification     | Missing secret fails closed (locks owner out)         |

**Prerequisites:** S-03's only roadmap prereq (F-01, the app shell) is already done. Need `wrangler` access to set the production secret.
**Estimated effort:** ~1–2 sessions across 3 phases; small surface (≈4 new files + tests).

## Open Risks & Assumptions

- Brute-force on a public URL is unmitigated by design in v1 (accepted). With no rate-limiting and an unsalted `SHA-256(passphrase)` cookie, passphrase entropy is the entire security model — so the deploy secret must be generated/high-entropy (a hard requirement, not a footnote). KV-backed throttling is the v2 path if needed.
- A misconfigured/unset `APP_PASSPHRASE` fails closed — set the secret in the same window as the deploy.
- Single shared passphrase is acceptable per PRD v2; real accounts would be a separate PRD change.

## Success Criteria (Summary)

- Visiting the live app without the passphrase shows the unlock page; nobody reaches the tool ungated.
- The correct passphrase grants 30-day access and the tool works unchanged; a wrong one is rejected with an error.
- Skill/posting data still never leaves the device.
