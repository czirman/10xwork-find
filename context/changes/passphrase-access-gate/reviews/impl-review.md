<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Passphrase Access Gate (S-03)

- **Plan**: context/changes/passphrase-access-gate/plan.md
- **Scope**: Full plan (Phases 1–3 of 3)
- **Date**: 2026-06-13
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Success criteria re-run on review date: `npm run build` PASS (exit 0); `npm run lint` PASS (0 errors, 1 pre-existing unrelated `no-console` warning in `useBaseSkills.ts`); `npm run test:run` 92/92; `npx playwright test` 5/5 (pristine run — an earlier 1-test failure was a flake from competing dev-server processes, green when isolated).

## Findings

### F1 — Unrelated/generated files bundled into the implementation commit

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: commit 3b76850 ("Rewrite auth module complete")
- **Detail**: The single implementation commit includes two paths flagged for exclusion: `my-notes/ai-szkolenie.txt` (pre-existing local notes, unrelated to S-03) and `playwright-report/index.html` (generated test-report artifact). All three phases landed in one manual commit titled "Rewrite auth module complete" — slightly inaccurate (this is a new passphrase gate, not a rewrite of the removed Supabase module) and the reason every Progress row is SHA-less. Cosmetic, not functional.
- **Fix**: Optionally, in a follow-up commit, `git rm --cached playwright-report/` and add it to `.gitignore`; revert the `my-notes` change if unintended. Nothing to undo in the gate itself.
- **Decision**: PENDING

### F2 — "30-day expiration" is client-side only; session token is static

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/auth-gate.ts (deriveToken), src/pages/api/unlock.ts
- **Detail**: The cookie value is an unsalted SHA-256(passphrase) with no timestamp or nonce. (a) The 30-day expiry is only the browser-enforced cookie maxAge — the token never expires, so a captured cookie value is replayable indefinitely until the passphrase is rotated. (b) The cookie is exactly SHA-256(passphrase), so a weak passphrase is offline-brute-forceable from a leaked cookie. This is the documented, accepted KISS threat model (plan "What We're NOT Doing" + Open Risks; README mandates a high-entropy secret; httpOnly+secure limit realistic theft vectors) and is appropriate for a single-user private gate. Flagged so the limitation is explicit, not because it deviates from the plan.
- **Fix**: None required — accept as designed. If true expiry/revocation is ever wanted, the minimal upgrade is to bake an issued-at timestamp into the cookie and HMAC it with a second secret (validate age server-side). Deliberate future change, not a v1 gap.
- **Decision**: PENDING

### F3 — e2e spec path differs from plan (justified)

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/test/passphrase-gate.e2e.spec.ts
- **Detail**: Plan named `e2e/passphrase-gate.spec.ts`; impl used `src/test/passphrase-gate.e2e.spec.ts` to match actual project config (playwright.config `testDir: ./src/test`, `testMatch **/*.e2e.spec.ts`; vitest excludes `*.e2e.spec.ts`). Correct adaptation to reality.
- **Decision**: PENDING

### F4 — Extra files beyond plan: test helper + seed-spec edit (justified)

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/test/helpers/auth.ts, src/test/seed.e2e.spec.ts
- **Detail**: Not in the plan, but the gate regressed the existing seed e2e (it hit `/` and got redirected). Added `unlockViaCookie` + a `beforeEach` ("authenticate without the UI"). Necessary regression fix, surfaced during Phase 3.
- **Decision**: PENDING

### F5 — Dev passphrase default duplicated in test helper

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/test/helpers/auth.ts:9
- **Detail**: `TEST_PASSPHRASE` defaults to the literal `"dev-local-passphrase-change-me"`, duplicating `.dev.vars`. Not a production secret, but changing `.dev.vars` without setting `E2E_PASSPHRASE` (or updating the default) silently breaks e2e. Acceptable coupling to remember.
- **Decision**: PENDING
