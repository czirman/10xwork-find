# Base-skills Persistence & CRUD-Integrity Tests — Implementation Plan

## Overview

Add the risk-based tests that protect the shipped S-01 (`manage-base-skills`)
slice — rollout **Phase 1** of `context/foundation/test-plan.md`, covering
**Risk #4** (the saved list is lost or silently corrupted across sessions) and
**Risk #6** (a CRUD operation corrupts the list). The oracle and the coverage
gaps were resolved upstream in `research.md`; this plan turns them into ordered,
red-to-green test sub-phases. No production code changes, no new test infra.

## Current State Analysis

The S-01 surface is small and cleanly layered (see `research.md`):

- `src/lib/services/skills.ts` — pure validation + dedup. **Already well unit-tested**
  (`skills.test.ts`): empty/whitespace rejection, tech-punctuation acceptance,
  max-length boundary, control-char rejection, case-insensitive dedup incl. `excludeId`.
- `src/components/hooks/useBaseSkills.ts` — state + `localStorage` persistence + CRUD.
  **Partially tested** (`useBaseSkills.test.ts`): add+persist, case-insensitive duplicate
  rejection, edit-in-place (single-item list), delete-correct-item + restore-at-index,
  fallback-to-`[]` on malformed / unknown-version data.
- `src/components/BaseSkillsManager.tsx` — presentational island; out of scope for #4/#6.

Test runner is configured: Vitest 4.1.x + jsdom + `@testing-library/react`. Scripts:
`npm run test:run` (vitest run), `npm run lint`, `npm run test:coverage`; type check is
`npx astro check`.

### Key Discoveries:

- **Mount write-back / destroy-on-open** (`useBaseSkills.ts:72,74-76`): state is seeded
  from `readStore()` and a mount effect runs `writeStore(skills)`, so unreadable /
  unknown-version stored bytes are read as `[]` and **overwritten with an empty v1
  envelope on app-open**. Per the 2026-06-04 decision this is *intended* for the
  version-mismatch case — it is documented here as conscious behavior, not a bug.
- **Untested hook branches (#6)**: `editSkill` collision rejection (`:91-93`),
  `editSkill` validation rejection, edit-among-many sibling-safety, `removeSkill`
  non-existent-id → `null` (`:100`).
- **Untested persistence promise (#4)**: no test proves a true round-trip *through a
  remount* (mutate → unmount → fresh `renderHook` → identical). Write side and read side
  are tested separately today.
- **Oracle is fixed and source-grounded** — see the table in `research.md` (FR-004,
  NFR, the `types.ts:17-24` contract, and the 2026-06-04 discard-on-version-mismatch
  decision). Expected values must trace to these, never to `readStore`/`editSkill` output.

## Desired End State

`npm run test:run` passes with new cases that fail if any of these regress:

- A saved skills list survives a simulated restart (add/edit/delete each round-trip).
- Absent / corrupt / unknown-version stored data degrades to `[]` without crashing.
- `add` rejects empty/whitespace and duplicates; `edit` rejects a collision with a
  *different* skill and touches only the intended id among many; `delete` removes only
  the intended id; a missing-id delete is a safe no-op.
- CRUD does not throw when `localStorage` writes fail.

And `context/foundation/test-plan.md` §6.1/§6.2 document the shipped patterns, with §2 #4
carrying the version-mismatch exception note.

## What We're NOT Doing

- **No production code changes.** This phase tests current, agreed behavior. If the team
  later wants *recoverable* migration instead of discard-on-version-mismatch, that is a
  separate change (bug→fix→regression is Lesson 5).
- **No `restoreSkill` clamping / idempotency tests** — declined (low likelihood; the UI
  only ever restores the just-deleted item).
- **No Stryker / mutation-testing gate** — kept ad-hoc per CLAUDE.md; this phase is
  unit + integration only, matching `test-plan.md` §3.
- **No network / data-locality assertion** — that is Risk #5 / rollout Phase 2.
- **No e2e or AI-native layer** — unwarranted for a one-page on-device tool (`test-plan.md` §4).
- **No `BaseSkillsManager` component tests** — its happy paths shipped with S-01; not a
  persistence or integrity surface.

## Implementation Approach

Extend the two existing test files (one per module, following the project convention),
grouping the new cases under clearly named `describe` blocks so risk-coverage intent is
legible. Use the **real jsdom `localStorage`** (never a mock of the storage layer — that
would hide the serialization bug #4 is about). Drive the hook with `renderHook` + `act`.
Order the work #6 → #4 → docs: prove each CRUD operation is correct in memory first, then
prove it persists across a remount, then capture the cookbook.

## Phase 1: CRUD integrity (#6)

### Overview

Close the hook-layer gaps that let a CRUD operation corrupt the list: edit collisions,
invalid edits, sibling safety, and missing-id deletes. Extends `useBaseSkills.test.ts`.

### Changes Required:

#### 1. Edit-collision and edit-validation rejection

**File**: `src/components/hooks/useBaseSkills.test.ts` (extend)

**Intent**: Prove `editSkill` refuses to rename a skill onto a name already owned by a
*different* skill, and refuses an empty/invalid new name — in both cases returning
`{ok:false}` and leaving the list unmutated. Catches a regression where editing silently
merges or duplicates entries.

**Contract**: New `describe("editSkill integrity")`. Drive `useBaseSkills` via `renderHook`;
seed ≥2 skills; assert `editSkill(idA, "<name-of-B>")` returns `ok:false` and `skills`
is unchanged (names + order + ids identical). Add a case for `editSkill(id, "")` →
`ok:false`, list unchanged. Oracle: FR-002 (edit must not corrupt the list); the
collision rule is the same case-insensitive dedup as add. Anti-pattern avoided:
happy-path-only edit.

#### 2. Edit targets only the intended item among many

**File**: `src/components/hooks/useBaseSkills.test.ts` (extend)

**Intent**: Prove a successful edit changes only the targeted id and leaves siblings
untouched (the existing edit test uses a single-item list and cannot show this).

**Contract**: Seed a 3-skill list; `editSkill(middleId, "NewName")`; assert the middle
name changed and the other two are byte-identical (name + id + position). Oracle: FR-002.

#### 3. Delete of a non-existent id is a safe no-op

**File**: `src/components/hooks/useBaseSkills.test.ts` (extend)

**Intent**: Prove `removeSkill("does-not-exist")` returns `null` and leaves the list
unchanged — guards the `findIndex === -1` branch (`useBaseSkills.ts:100`).

**Contract**: Seed a list; call `removeSkill` with an unknown id inside `act`; assert
return is `null` and `skills` unchanged. Oracle: FR-003 (delete removes only the intended
item — and nothing when there is no match).

### Success Criteria:

#### Automated Verification:

- Tests pass: `npm run test:run`
- Lint passes: `npm run lint`
- New `editSkill` collision test fails if the `isDuplicate(..., id)` guard
  (`useBaseSkills.ts:91-93`) is removed (verified by temporarily breaking it locally).

#### Manual Verification:

- The new `describe` blocks read as behavior (FR-002/FR-003), not as restatements of the
  implementation.

**Implementation Note**: After automated verification passes, pause for human confirmation
before Phase 2.

---

## Phase 2: Persistence & degrade-safely (#4)

### Overview

Prove FR-004's actual cross-session promise via a real round-trip through a remount, and
pin the degrade-safely behavior (including the conscious destroy-on-open decision and
no-throw-on-storage-failure). Extends `useBaseSkills.test.ts`.

### Changes Required:

#### 1. Round-trip through a simulated restart

**File**: `src/components/hooks/useBaseSkills.test.ts` (extend)

**Intent**: Prove that a mutated list survives a session boundary. Add, then edit, then
delete (three cases), each followed by unmounting the hook and mounting a fresh one
(reading from the same real `localStorage`), asserting the second mount reflects the
mutation. This is the headline #4 test that the separate write-side / read-side tests do
not cover.

**Contract**: New `describe("persistence round-trip")`. Pattern: `renderHook` → `act`
mutation → `unmount()` → second `renderHook(() => useBaseSkills())` → assert
`result.current.skills` equals the **literal expected list** (the value the test
constructed — NOT a value re-read via `readStore`). Cover add-survives, edit-survives,
delete-survives. Oracle: FR-004. Anti-patterns avoided: over-mocking storage (use real
jsdom `localStorage`); asserting via a second `readStore` call (oracle/mirror trap).

#### 2. Destroy-on-open is a conscious decision

**File**: `src/components/hooks/useBaseSkills.test.ts` (extend)

**Intent**: Document the agreed discard-and-start-fresh behavior as deliberate: opening
with corrupt or unknown-version stored data yields `[]`, and a subsequent add persists a
clean `{version:1}` envelope (the prior unreadable bytes are gone by design).

**Contract**: Seed `localStorage` with an unknown-version envelope (and a corrupt-JSON
variant); mount; assert `skills === []`; `act` an add; assert the raw stored value is now
a valid `{version:1, skills:[…]}` envelope. Reference the 2026-06-04 decision + the
`types.ts:17-24` contract in a comment so the oracle is traceable. Oracle: the documented
product decision, NOT `readStore` behavior.

#### 3. CRUD does not throw on a storage-write failure

**File**: `src/components/hooks/useBaseSkills.test.ts` (extend)

**Intent**: Prove the persist effect's best-effort guard (`useBaseSkills.ts:61-64`) holds:
when `localStorage.setItem` throws (quota exceeded / private mode), an add still updates
in-memory state and does not crash.

**Contract**: `vi.spyOn(window.localStorage, "setItem").mockImplementation(() => { throw … })`
(restore after); mount, `act` an add; assert no throw and `skills` reflects the add.
Oracle: NFR robustness — the tool must not crash when on-device storage is unavailable.

### Success Criteria:

#### Automated Verification:

- Tests pass: `npm run test:run`
- Lint passes: `npm run lint`
- Coverage on the two modules does not regress: `npm run test:coverage`
- Round-trip test fails if the `writeStore` call in the mount effect
  (`useBaseSkills.ts:75`) is disabled (verified by temporarily breaking it locally).

#### Manual Verification:

- The round-trip assertions use a literal expected list, not a re-read of the store.
- The destroy-on-open test's comment names the 2026-06-04 decision as its oracle.

**Implementation Note**: After automated verification passes, pause for human confirmation
before Phase 3.

---

## Phase 3: Cookbook + plan sync (docs)

### Overview

Capture the shipped patterns in the test-plan cookbook and reconcile §2/§3, so a future
reader (or `/10x-tdd`) can add tests by area without re-deriving the approach.

### Changes Required:

#### 1. Fill the cookbook (§6.1, §6.2)

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the §6.1 (unit) and §6.2 (persistence) TBD placeholders with the
concrete patterns this phase established.

**Contract**: §6.1 — how to add a `skills.ts` unit test (pure function, assert the rule
not the `normalize` output). §6.2 — how to add a `useBaseSkills` persistence test
(`renderHook` + real jsdom `localStorage`, mutate → unmount → fresh `renderHook`, assert
the literal list). Reference `useBaseSkills.test.ts` / `skills.test.ts` as the worked
examples.

#### 2. Backport the §2 #4 wording exception

**File**: `context/foundation/test-plan.md`

**Intent**: Make §2 self-consistent with the 2026-06-04 decision so "degrades safely
instead of … wiping" is not misread as "never wipe."

**Contract**: Add a half-line to §2 #4 (Risk Response Guidance "What would prove
protection" cell or an adjacent note): unknown/future-version stored data is
*intentionally* discarded (start-fresh), per the 2026-06-04 decision — this is not a wipe
of valid current data. No file anchors added (principle #3 holds).

#### 3. Reconcile rollout status

**File**: `context/foundation/test-plan.md` §3

**Intent**: Reflect that rollout Phase 1 is implemented.

**Contract**: Phase 1 row Status → `complete` once Phases 1–2 of this plan are green.
(The orchestrator may also set this; setting it here keeps the row honest.)

### Success Criteria:

#### Automated Verification:

- No TBD placeholders remain in §6.1/§6.2: `grep -n "TBD" context/foundation/test-plan.md`
  returns nothing for §6.1/§6.2.
- Full suite still green: `npm run test:run`

#### Manual Verification:

- §6 patterns are accurate enough that a fresh reader could add a new persistence test
  from them alone.
- §2 #4 reads consistently with the discard decision.

**Implementation Note**: Final phase — after this, commit and mark the rollout phase
complete.

---

## Testing Strategy

### Unit Tests:

- `skills.ts` validation/dedup is already covered; add a case only if a concrete gap
  surfaces during Phase 1 (none currently known).

### Integration Tests:

- `useBaseSkills` via `renderHook` + real jsdom `localStorage`: CRUD integrity (Phase 1),
  persistence round-trip through remount + degrade-safely (Phase 2).

### Manual Testing Steps:

1. Run `npm run test:run` — all new and existing tests green.
2. Temporarily break the `isDuplicate(..., id)` guard (`useBaseSkills.ts:91-93`) and
   confirm the edit-collision test goes red; revert.
3. Temporarily disable the mount-effect `writeStore` (`useBaseSkills.ts:75`) and confirm
   the round-trip test goes red; revert.

## Migration Notes

None — tests only. The version-mismatch behavior is documented (not changed); a future
`version: 2` envelope should ship with a real migration rather than relying on
discard-and-start-fresh.

## References

- Related research: `context/changes/testing-base-skills-crud/research.md`
- Rollout phase: `context/foundation/test-plan.md` §3 Phase 1 (Risks #4, #6)
- Oracle sources: `context/foundation/prd.md:70` (FR-004), `:88` (NFR);
  `src/types.ts:17-24` (persistence contract)
- Code under test: `src/components/hooks/useBaseSkills.ts`, `src/lib/services/skills.ts`
- Existing tests: `src/components/hooks/useBaseSkills.test.ts`,
  `src/lib/services/skills.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: CRUD integrity (#6)

#### Automated

- [x] 1.1 Tests pass: `npm run test:run` — 1e0c36c
- [x] 1.2 Lint passes: `npm run lint` — 1e0c36c
- [x] 1.3 Edit-collision test fails when the `isDuplicate(..., id)` guard is removed (local check) — 1e0c36c

#### Manual

- [x] 1.4 New `describe` blocks read as FR-002/FR-003 behavior, not implementation restatements — 1e0c36c

### Phase 2: Persistence & degrade-safely (#4)

#### Automated

- [x] 2.1 Tests pass: `npm run test:run` — 42f7a3b
- [x] 2.2 Lint passes: `npm run lint` — 42f7a3b
- [x] 2.3 Coverage on the two modules does not regress: `npm run test:coverage` — 42f7a3b
- [x] 2.4 Round-trip test fails when the mount-effect `writeStore` is disabled (local check) — 42f7a3b

#### Manual

- [x] 2.5 Round-trip assertions use a literal expected list, not a re-read of the store
- [x] 2.6 Destroy-on-open test comment names the 2026-06-04 decision as its oracle

### Phase 3: Cookbook + plan sync (docs)

#### Automated

- [ ] 3.1 No TBD remains in §6.1/§6.2: `grep -n "TBD" context/foundation/test-plan.md`
- [ ] 3.2 Full suite still green: `npm run test:run`

#### Manual

- [ ] 3.3 §6 patterns let a fresh reader add a new persistence test from them alone
- [ ] 3.4 §2 #4 reads consistently with the discard-and-start-fresh decision
