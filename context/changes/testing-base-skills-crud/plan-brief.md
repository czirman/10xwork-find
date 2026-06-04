# Base-skills Persistence & CRUD-Integrity Tests — Plan Brief

> Full plan: `context/changes/testing-base-skills-crud/plan.md`
> Research: `context/changes/testing-base-skills-crud/research.md`

## What & Why

Add the risk-based tests that protect the shipped S-01 (`manage-base-skills`) slice —
rollout **Phase 1** of `context/foundation/test-plan.md`. It targets **Risk #4** (the
saved skills list is lost or silently corrupted across sessions) and **Risk #6** (a CRUD
operation corrupts the list). The slice currently has happy-path tests; these add the
cross-session and integrity regressions that actually catch user-visible data loss.

## Starting Point

`skills.ts` (pure validation/dedup) is well unit-tested. `useBaseSkills.ts`
(state + `localStorage` + CRUD) is only partly tested: add/persist, duplicate rejection,
single-item edit, delete-correct-item, and fallback-to-`[]` on bad data. Untested: the
true reload round-trip, `editSkill` collision/validation branches, sibling-safety on
edit, and missing-id delete. Vitest + jsdom + `@testing-library/react` already configured.

## Desired End State

`npm run test:run` passes with tests that fail if: a saved list does not survive a
simulated restart; absent/corrupt/unknown-version data crashes instead of degrading to
`[]`; add accepts an empty/duplicate; edit collides with or overwrites the wrong skill;
delete removes the wrong item; or CRUD throws when storage writes fail. The test-plan
cookbook (§6.1/§6.2) documents how to add such tests.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Version-mismatch oracle | Discard & start fresh is intended | `version` is a breaking-change tripwire; FR-004 protects valid current data, not unknown-version data | Research |
| Test file organization | Extend existing files | Follows the project's one-test-file-per-module convention | Plan |
| Edge tests included | Destroy-on-open-conscious + writeStore-no-throw | Both give cheap, real signal; `restoreSkill` clamping declined as low-signal | Plan |
| Mutation gate (Stryker) | No — unit + integration only | Matches §3 Phase 1 scope; CLAUDE.md keeps Stryker ad-hoc, and it isn't installed | Plan |
| §2 #4 wording exception | Backport in final sub-phase | Keep §2 self-consistent with the discard decision while it's fresh | Plan |
| Oracle source | FR-004 + NFR + `types.ts` contract + 2026-06-04 decision | Expected values must trace to sources, never to `readStore` output | Research |

## Scope

**In scope:** hook-layer CRUD-integrity tests (#6); persistence round-trip-through-remount
+ degrade-safely tests (#4); two chosen edge tests; cookbook §6.1/§6.2 + §2 #4 backport.

**Out of scope:** any production code change; `restoreSkill` clamping/idempotency; Stryker;
network/data-locality (Risk #5 / Phase 2); e2e / AI-native; `BaseSkillsManager` tests.

## Architecture / Approach

Extend `useBaseSkills.test.ts` and `skills.test.ts`, grouping additions under named
`describe` blocks. Drive the hook with `renderHook` + `act` against the **real jsdom
`localStorage`** (never a storage mock — that would hide the serialization bug #4 is
about). The headline #4 test simulates a restart by unmounting and mounting a fresh hook,
asserting the **literal** expected list rather than a value re-read through `readStore`
(avoids the oracle/mirror trap). Order: prove operations correct in memory (#6) → prove
they persist across a remount (#4) → capture the cookbook.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. CRUD integrity (#6) | Edit-collision/validation rejection, sibling-safe edit, missing-id delete no-op | Writing happy-path-only tests that miss the collision branch |
| 2. Persistence & degrade-safely (#4) | Round-trip through remount; destroy-on-open-conscious; no-throw on storage failure | Asserting via a re-read instead of a literal list (mirror test) |
| 3. Cookbook + plan sync (docs) | §6.1/§6.2 patterns; §2 #4 exception note; §3 status | Cookbook drifts from what was actually shipped |

**Prerequisites:** S-01 shipped (done); Vitest + jsdom configured (done).
**Estimated effort:** ~1 session across 3 phases (2 test phases + a short docs phase).

## Open Risks & Assumptions

- `writeStore` silent-failure test stubs `localStorage.setItem` to throw — must restore the
  spy so it doesn't leak into other tests.
- The discard-on-version-mismatch decision is assumed stable; if the team later wants
  recoverable migration, that's a separate (Lesson 5) change, and these tests would update.

## Success Criteria (Summary)

- A user's saved skills survive closing and reopening the tab; corrupt/unknown data never
  crashes the tool.
- Editing or deleting one skill never silently alters or loses another.
- A future contributor can add a persistence test by following the cookbook alone.
