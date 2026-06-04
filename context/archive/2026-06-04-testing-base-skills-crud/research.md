---
date: 2026-06-04T17:26:54+02:00
researcher: Claude (10x-research)
git_commit: 463e8f0
branch: slice-s-01
repository: shaping-both
topic: "Risk #4 (base-skills persistence) and Risk #6 (CRUD integrity) — oracle + failure surface for rollout Phase 1"
tags: [research, codebase, base-skills, persistence, localStorage, crud, testing]
status: complete
last_updated: 2026-06-04
last_updated_by: Claude (10x-research)
---

# Research: Base-skills persistence (#4) & CRUD integrity (#6)

**Date**: 2026-06-04T17:26:54+02:00
**Researcher**: Claude (10x-research)
**Git Commit**: 463e8f0
**Branch**: slice-s-01
**Repository**: shaping-both

## Research Question

Ground rollout Phase 1 of `context/foundation/test-plan.md` ("Base-skills
persistence & CRUD integrity"), covering **Risk #4** (the saved list is lost or
silently corrupted across sessions) and **Risk #6** (a CRUD operation corrupts the
list — duplicate, empty/whitespace accepted, edit collides, wrong item deleted).

For each risk: derive the **oracle from sources** (PRD, NFR, documented contract,
explicit product decision) — not from the implementation — locate the real failure
path in code, identify what existing tests already cover, name the cheapest useful
test layer, and flag any oracle ambiguity.

## Summary

The shipped S-01 surface is small and cleanly layered:

- `src/lib/services/skills.ts` — pure validation + dedup (no I/O).
- `src/components/hooks/useBaseSkills.ts` — state + `localStorage` persistence + CRUD.
- `src/components/BaseSkillsManager.tsx` — presentational island (out of scope for
  #4/#6; its transient UI state is not a persistence or integrity surface).

**Oracle sources used (never the implementation):**

- **FR-004** (`prd.md:70-71`): *"Base skills list persists between sessions … persistence
  must be guaranteed regardless of storage mechanism chosen downstream."*
- **NFR** (`prd.md:88`): *"No base skill data … leaves the user's device."*
- **FR-001/002/003** (`prd.md:64-69`): add / edit / delete are each must-have.
- **Documented persistence contract** (`src/types.ts:17-24`): the `SkillsStore`
  envelope is *"versioned so future schema changes have a migration seam; reads must
  tolerate older/unknown shapes by falling back to an empty list rather than throwing."*
- **Explicit product decision (2026-06-04):** for stored data with an **unknown /
  future schema version**, **discard-and-start-fresh is the intended behavior** — the
  `version` field is a deliberate breaking-change tripwire, not a recoverable-migration
  promise in v1. This resolves the one oracle ambiguity (see *Oracle Decisions*).

**Two faces of Risk #4** (per the lesson's "one safe face, one real face"):

1. **Safe / already-correct face** — write→reload round-trip, absent data, and
   corrupt-data-no-crash all have unambiguous oracles and are partly tested today.
2. **Real face — destroy-on-open** — `useBaseSkills` seeds state from `readStore()`
   and runs `writeStore(skills)` in a **mount effect**, so any stored payload that
   `readStore` cannot accept (corrupt JSON, or an unknown `version`) is read as `[]`
   and then **overwritten with `{version:1, skills:[]}` on app-open, before the user
   acts** — the original bytes are permanently gone. Given the 2026-06-04 decision,
   this destroy-on-open is *consistent with intent* for the version-mismatch case, but
   it must be a **conscious, documented** behavior, not a hidden one. No bug to fix in
   this phase.

**Risk #6** is well covered at the **pure-logic layer** (`skills.test.ts`) but has
real gaps at the **hook layer**: `editSkill`'s collision-rejection and validation
branches, and persistence-survives-reload after edit/delete, are not exercised.

## Oracle Decisions (the source of truth for expected values)

> These are the independent oracles every Phase-1 test must assert against. None is
> derived by reading `readStore`/`writeStore`/`editSkill` output.

| Case | Oracle (expected behavior) | Source |
|------|----------------------------|--------|
| Write then reload (simulated restart) | List reads back **identical** to what was written (same names, same order, same ids) | FR-004 (`prd.md:70`) |
| No stored data (absent key) | Empty list, no crash | FR-004 + contract (`types.ts:21-24`) |
| Corrupt / unparseable stored data | Empty list, **no throw** ("cannot persist what cannot be parsed") | contract `types.ts:23-24` |
| Stored data with unknown/future `version` | **Discard** → empty list (start fresh) | **Decision 2026-06-04** + contract `types.ts:23-24` |
| Add empty / whitespace-only name | **Rejected**, list unchanged | FR-001 + Business Logic (declared skills only) |
| Add case-insensitive / whitespace duplicate | **Rejected**, list unchanged | normalization rule (`prd.md` Business Logic); dedup is case/space-insensitive |
| Edit to a name colliding with a **different** existing skill | **Rejected**, no mutation | FR-002 (edit is a first-class op, must not corrupt list) |
| Edit a skill among many | Only the targeted id changes; siblings untouched; change persists | FR-002 + FR-004 |
| Delete a skill among many | Only the targeted id is removed; siblings untouched; change persists | FR-003 + FR-004 |
| No base skill data leaves device | Persistence path touches only `localStorage`; **no network** | NFR (`prd.md:88`) — note: the *network* assertion is **Risk #5 / Phase 2**, not this phase |

## Detailed Findings

### Risk #4 — persistence / reload / degrade-safely

**Failure surface — `src/components/hooks/useBaseSkills.ts`:**

- `readStore()` (`useBaseSkills.ts:31-55`): SSR guard → `getItem` → `JSON.parse` →
  validates `version === 1` **and** `Array.isArray(skills)`, then filters each entry
  to `{id:string, name:string}`. Any failure path returns `[]`. This is the read-tolerance
  the `types.ts` contract describes.
- `writeStore()` (`useBaseSkills.ts:57-65`): serializes `{version:1, skills}`; wraps in
  try/catch that **silently swallows** quota-exceeded / storage-disabled (private mode).
- **Mount write-back (the destroy-on-open mechanism)** — `useBaseSkills.ts:72,74-76`:
  ```
  const [skills, setSkills] = useState<Skill[]>(readStore);     // seed from store
  useEffect(() => { writeStore(skills); }, [skills]);           // runs once post-mount
  ```
  **Verified by code trace:** React runs an effect once after the initial commit; the
  `[skills]` dependency only gates *subsequent* runs. So on mount `writeStore` fires with
  the seeded value — if `readStore` fell back to `[]`, the stored key is overwritten with
  an empty v1 envelope immediately, regardless of what raw bytes were there.

**Existing coverage (`useBaseSkills.test.ts`):**

| Test | Lines | Oracle case covered |
|------|-------|---------------------|
| starts empty when nothing stored | 12-15 | absent data → `[]` ✅ |
| adds + persists to localStorage | 17-31 | write side of round-trip (asserts raw envelope) ✅ (partial) |
| reads a pre-seeded list on mount | 33-38 | read side (hand-seeded value) ✅ (partial) |
| falls back to `[]` on malformed data | 90-94 | corrupt → `[]`, no crash ✅ |
| falls back to `[]` on unexpected version | 96-100 | version-mismatch → `[]` ✅ **— oracle now re-grounded on Decision 2026-06-04, not on impl behavior** |

**Gaps for #4 (what Phase 1 should add):**

1. **True round-trip through a remount.** Today the write side and read side are tested
   *separately* (L17-31 write; L33-38 read a hand-seeded value). Neither proves
   FR-004's actual promise: *add via the hook → simulate restart (unmount + fresh
   `renderHook`) → the added skill is still there, identical.* This is the headline #4
   test and the cheapest real signal. **Oracle = the exact list written** (independent
   of the code).
2. **Round-trip after edit and after delete.** Mutations beyond add must also survive a
   reload (ties #6 into #4). Edit a skill → remount → new name persists. Delete →
   remount → gone.
3. **Destroy-on-open made conscious.** One test pins the *intended* consequence of the
   2026-06-04 decision: open with corrupt/unknown-version bytes → list is `[]` → a
   subsequent add persists a clean `{version:1}` envelope. This documents the
   discard-and-start-fresh decision as deliberate. (Not a bug fix — the behavior is the
   agreed oracle.)

**Anti-patterns to avoid (from §2 #4):** over-mocking the storage layer so the real
serialization never runs — **use real jsdom `localStorage`** (existing tests already
do; keep it). And do **not** assert the round-trip's expected value by calling
`readStore` again on the same store — assert the **literal list you wrote**.

### Risk #6 — CRUD integrity

**Failure surface:**

- `validateSkillName` (`skills.ts:39-56`): empty/whitespace → reject; >80 chars → reject;
  disallowed chars → reject; else normalized value.
- `isDuplicate` (`skills.ts:62-65`): case-insensitive, whitespace-collapsed key; `excludeId`
  lets an edit keep its own row.
- `addSkill` / `editSkill` (`useBaseSkills.ts:78-96`): both call `validateSkillName` then
  `isDuplicate` (edit passes `id` as `excludeId`) before mutating; both return
  `{ok:false, error}` on rejection.
- `removeSkill` (`useBaseSkills.ts:98-104`): `findIndex` by id; returns `null` if not found;
  otherwise filters out **only** that id and returns `{skill, index}` for undo.
- `restoreSkill` (`useBaseSkills.ts:106-113`): re-inserts at clamped index; **guards against
  re-inserting an id that already exists**.

**Existing coverage:**

- **Pure logic — strong (`skills.test.ts`):** empty/whitespace rejection (15-23),
  single-char + tech-punctuation acceptance (25-35), max-length boundary (41-49),
  control-char/emoji rejection (51-54), case-insensitive dedup (57-79 incl. `excludeId`).
- **Hook — partial (`useBaseSkills.test.ts`):** add+persist (17-31), case-insensitive
  duplicate rejection via the hook (40-52), edit-in-place on a single-item list (54-65),
  delete-correct-item-among-many + restore-at-index (67-88).

**Gaps for #6 (what Phase 1 should add):**

1. **`editSkill` collision rejection at the hook layer.** `isDuplicate(..., excludeId)` is
   unit-tested in isolation (`skills.test.ts:74-79`), but the hook branch
   `useBaseSkills.ts:91-93` (edit to a name owned by a *different* skill → `{ok:false}`,
   **no mutation**) is never exercised through the hook. **Oracle: FR-002** — editing must
   not silently merge/overwrite a different skill.
2. **`editSkill` validation rejection at the hook layer** (edit to empty/invalid → rejected,
   row unchanged).
3. **Edit targets only the intended item among many.** Existing edit test has a one-item
   list, so it cannot prove siblings are untouched. Use a 3-item list.
4. **`removeSkill` on a non-existent id → `null`, list unchanged** (`useBaseSkills.ts:100`).
5. **`restoreSkill` idempotency guard** — restoring an id already present is a no-op
   (`useBaseSkills.ts:108`); and index clamping when the original index is now out of range.
6. **Mutations persist** — add/edit/delete each survive a remount (shared with #4 gap 2).

**Anti-patterns to avoid (from §2 #6):** happy-path-only ("add one, assert present"). Every
new #6 test must carry a **collision / dedupe / empty / wrong-target** case. Do **not**
snapshot `normalize()` output (that mirrors the implementation — §2 #2's warning applies by
adjacency); assert the **rule** (e.g. `"Git"` and `" git "` collide) instead.

## Cheapest-useful-layer recommendation

| Behavior | Layer | Why not cheaper / not pricier |
|----------|-------|-------------------------------|
| Validation + dedup rules (#6 logic) | **unit** on `skills.ts` | Pure functions; already the right layer. No DOM, no storage needed. |
| Add/edit/delete + reject branches via the hook (#6) | **integration** via `renderHook` + real jsdom `localStorage` | The hook is where validation, dedup, and persistence compose; a mock would lie about the round-trip. |
| Round-trip survives reload (#4) | **integration** — `renderHook`, mutate, **unmount + fresh `renderHook`**, assert | The only layer that proves FR-004's cross-session promise. e2e would add no signal for an on-device one-page tool (§4: no e2e in v1). |
| Absent / corrupt / unknown-version degrade-safely (#4) | **integration** — seed `localStorage` raw, mount, assert `[]` + no throw | Must exercise real serialization (§2 #4 anti-pattern). |

No AI-native or e2e layer is warranted (`test-plan.md §4`: deterministic, on-device,
one page).

## Code References

- `src/components/hooks/useBaseSkills.ts:31-55` — `readStore` tolerance (absent/corrupt/version → `[]`)
- `src/components/hooks/useBaseSkills.ts:57-65` — `writeStore` (silent quota/disabled swallow)
- `src/components/hooks/useBaseSkills.ts:72,74-76` — seed-from-store + **mount write-back** (destroy-on-open)
- `src/components/hooks/useBaseSkills.ts:78-96` — `addSkill` / `editSkill` validate→dedup→mutate
- `src/components/hooks/useBaseSkills.ts:98-113` — `removeSkill` / `restoreSkill` (id targeting, undo, guard)
- `src/lib/services/skills.ts:23-30` — `normalize` / `dedupKey` (case-insensitive, whitespace-collapsed)
- `src/lib/services/skills.ts:39-65` — `validateSkillName` / `isDuplicate` (+ `excludeId`)
- `src/types.ts:17-24` — `SkillsStore` documented persistence contract (read-tolerance / migration seam)
- `src/components/hooks/useBaseSkills.test.ts:1-101` — existing persistence/CRUD tests (gaps noted above)
- `src/lib/services/skills.test.ts:1-81` — existing pure-logic tests (strong)

## Architecture Insights

- **Clean three-layer split** (pure logic → stateful hook → presentational island) means
  #6's rules can be unit-tested cheaply, while the *composition* (validate+dedup+persist)
  needs the hook-level integration test. The split is the reason the cheapest-layer choice
  is unambiguous.
- **`name` is a cross-slice join key** (`types.ts:13`): S-02 matches `name` against postings,
  so persistence fidelity (#4) and dedup correctness (#6) protect not just this slice but the
  product hypothesis downstream. A corrupted/duplicated `name` would silently degrade S-02
  matching.
- **Versioned envelope as a migration seam** is documented intent (`types.ts:17-24`), but v1
  deliberately implements the seam as *discard-on-mismatch* (Decision 2026-06-04), not as an
  actual migration. Worth a one-line note wherever the envelope is next touched, so a future
  `version: 2` ships with a migration rather than a silent wipe.

## Oracle / anti-pattern notes carried to /10x-plan

- Every expected value traces to the **Oracle Decisions** table above — PRD/NFR/contract/
  explicit decision — never to `readStore`/`editSkill` output.
- The existing version-mismatch test (`useBaseSkills.test.ts:96-100`) is **kept**, but its
  justification is now the 2026-06-04 product decision + `types.ts` contract. A plan comment
  should re-ground it so a future reader doesn't mistake it for an implementation mirror.
- **No bug-fix in this phase.** The destroy-on-open mechanism is, for the version-mismatch
  case, the agreed behavior. (If the team later wants recoverable migration, that is a
  separate change — bug→fix→regression is Lesson 5, out of scope here.)

## Historical Context (from prior changes)

- `context/changes/manage-base-skills/plan.md` — S-01 plan; Phase 1 (persistence & domain
  logic) and Phase 2 (UI island) both shipped (`9a67e9b`, `3e2b7da`) and impl-reviewed
  (`54e6e34`). This is the code now under test.
- `context/changes/local-only-app-shell/` — F-01 removed the Supabase auth scaffold; the
  "no network" guarantee (NFR) it established is the subject of the sibling **Risk #5 /
  Phase 2**, not this phase.

## Related Research

- None yet under `context/changes/**/research.md`. This is the first research artifact for
  the test rollout.

## Open Questions

- **`writeStore` silent failure (quota / private mode)** — `useBaseSkills.ts:61-64` swallows
  the error, so persistence can fail with no user signal. Not in Risk #4's stated scope
  (`data_volume: small`, single user) and arguably an observability concern, not a test.
  Flagged for the plan to decide: assert "does not throw on storage failure" (cheap, real)
  vs. skip as low-signal. Not a blocker.
- **#6 edit/delete persistence** straddles #4 and #6; the plan should place the round-trip
  tests so they count once, not duplicate across the two risks.
