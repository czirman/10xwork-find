# Manage Base Skills Implementation Plan

## Overview

Give the single user a place to **add, edit, and delete** their base skills in a
personal list that **persists across sessions, on-device**. This is roadmap
**S-01** (FR-001–FR-004) — the data foundation the north star **S-02**
(generate-tailored-skills-section) depends on: the matching engine has nothing to
map without a saved base-skills list, and each skill's `name` is the exact join
key S-02 will match against the synonym map.

The feature is a single React island mounted at the `#app-root` placeholder that
F-01 already left in `src/pages/index.astro`, backed by a localStorage
persistence hook and a small set of pure validation/dedup functions.

## Current State Analysis

F-01 (local-only-app-shell) is fully merged. The app is a clean Astro 6 SSR shell
with no auth, no backend, no persistence layer:

- **Mount point exists.** `src/pages/index.astro` renders
  `<section id="app-root" aria-label="Narzędzie"></section>` with the comment
  *"Base-skills management (S-01) … mount here."* The page heading + Polish
  subheading are already in place; UI copy in this project is **Polish**.
- **No persistence anywhere.** There is no localStorage/IndexedDB usage and no
  `src/lib/services/`. The roadmap (S-01 Risk) explicitly says: *"do not reach for
  the scaffolded Supabase layer"* — Supabase was fully removed in F-01.
- **No `src/types.ts`** (CLAUDE.md says shared entity types live there) and **no
  `src/components/hooks/`** dir yet (CLAUDE.md: extract hooks there).
- **Island tooling is wired.** React 19 via `@astrojs/react`; shadcn/ui
  "new-york" with lucide icons (`npx shadcn@latest add <name>`); only
  `src/components/ui/button.tsx` is installed so far. `cn()` lives in
  `src/lib/utils.ts`.
- **Test stack is ready.** Vitest + jsdom + `@testing-library/react` +
  `@testing-library/user-event` + `jest-dom` (`src/test/setup.ts`). Run with
  `npm run test:run`. Existing example: `src/lib/utils.test.ts`.

### Key Discoveries:

- **SSR + localStorage is the one real trap.** `astro.config.mjs` is
  `output: "server"`; localStorage is browser-only. An island that reads
  localStorage during the server render crashes or produces a hydration mismatch.
  Resolved by mounting the island with **`client:only="react"`** (see Critical
  Implementation Details).
- **`name` is a cross-slice contract.** S-02 matches posting terms against base
  skills by `name`; over-aggressive validation that rejects real skills ("C",
  "Go", "CI/CD", "Node.js", ".NET", "C++", "C#") would silently break matching
  downstream. Validation is deliberately permissive (see Phase 1).
- **No zod here.** CLAUDE.md's "validate with zod" is an *API-route* convention;
  this slice has no API route. Plain validation functions suffice — pulling zod in
  for one text input is the over-engineering the roadmap warns against.
- **`src/pages/index.astro` is `.astro`**, so the React island is a separate
  `.tsx` component imported into the page and mounted into `#app-root`'s region
  (the island renders the section's contents).

## Desired End State

Opening `/` shows the existing header plus a working base-skills manager: an add
field, the saved list, per-row inline edit (Save/Cancel), and per-row delete with
a brief undo. The list survives a full page reload and a browser restart
(localStorage). Duplicate adds (case-insensitive, trimmed) are rejected with an
inline Polish message. All copy is Polish, consistent with the shell.

**Verification of end state:** `npm run build`, `npm run lint`, and
`npm run test:run` all pass; adding skills, reloading the page, and confirming the
list persists works manually; "C" and "CI/CD" are accepted, blank input is
rejected, and adding "git" when "Git" exists is refused with a message.

## What We're NOT Doing

- **Not building the synonym map.** "Manage base skills" is the user's flat skill
  list only. The synonym map is developer-maintained and consumed by **S-02** —
  out of scope here.
- **Not building any matching / posting / output logic.** That is S-02.
- **Not adding categories, grouping, tags, reordering/drag, or import/export.**
  v1 is a flat, insertion-ordered list.
- **Not soft-delete.** PRD FR-003 specifies hard delete; the "undo" is a
  short-lived client buffer, not a persisted disabled state.
- **Not using Supabase or any server/API persistence.** On-device localStorage
  only (PRD "data stays local", roadmap S-01 Risk).
- **Not adding zod** or any schema library for this slice.
- **Not redesigning `Layout.astro` or the page header** — the island fills the
  existing `#app-root` only.

## Implementation Approach

Two phases following the project's *data model → logic → UI* pattern, each leaving
a green build:

1. **Persistence & domain logic** — the `Skill` type, pure validation + dedup
   functions, and a localStorage-backed hook persisting a versioned envelope.
   Fully unit-tested. Nothing is mounted yet, so the build stays green and the
   risk-bearing logic is locked down before any UI exists.
2. **Skills-management UI island** — the React component (add form, list, inline
   edit, delete + undo, duplicate message) wired to the Phase 1 hook and mounted
   at `#app-root` via `client:only="react"`. Component tests cover the happy
   paths; manual verification covers persistence and rendering.

## Critical Implementation Details

- **SSR / localStorage — mount with `client:only="react"`.** The island is
  storage-backed and must never touch localStorage during SSR. Mounting it
  `client:only="react"` skips server rendering entirely and removes the whole
  hydration-mismatch class. Trade-off accepted: a brief empty `#app-root` on first
  paint before the island mounts — fine for a single-user local tool. (If a future
  change needs SSR content here, the alternative is `client:load` + "initialize
  state empty, load from localStorage in a `useEffect` after mount" — not used
  now.)
- **Versioned storage envelope.** Persist `{ version: 1, skills: Skill[] }` under a
  single localStorage key, not a bare array. This gives S-02 / v2 a migration seam.
  Reads must tolerate a missing key, malformed JSON, and an unexpected `version`
  by falling back to an empty list rather than throwing.

## Phase 1: Persistence & domain logic

### Overview

Establish the `Skill` entity, the pure validation/dedup rules, and the
localStorage persistence hook — all independently unit-testable, with no UI
mounted. Build stays green.

### Changes Required:

#### 1. Shared `Skill` type

**File**: `src/types.ts` (new)

**Intent**: Introduce the entity the whole slice (and S-02) shares. A skill needs
a **stable id** (edit/delete operate by identity, not by name) and the user-facing
`name` (S-02's join key).

**Contract**: Export `interface Skill { id: string; name: string }`. Also export
the persisted-envelope type `interface SkillsStore { version: 1; skills: Skill[] }`.

#### 2. Validation & dedup logic

**File**: `src/lib/services/skills.ts` (new)

**Intent**: Hold the pure, UI-independent rules so they can be unit-tested in
isolation and reused by both Add and Edit. Permissive by design so real
developer skills are never rejected (the `name` is S-02's join key).

**Contract**: Pure functions, no I/O. Suggested surface:

- `normalize(name: string): string` — trims, collapses internal whitespace; used
  as the canonical form for storage.
- `dedupKey(name: string): string` — `normalize(name).toLowerCase()`; the
  case-insensitive, trimmed comparison key.
- `validateSkillName(name: string): { ok: true; value: string } | { ok: false; error: string }`
  — applies: trim + reject empty/whitespace-only; **min length 1** (so "C", "R",
  "Go" pass); **max length 80** (reject longer, e.g. accidental paragraph paste);
  **permissive charset** allowing letters, digits, spaces and common tech
  punctuation `+ # . / - _` (so "CI/CD", "Node.js", ".NET", "C++", "C#" pass),
  rejecting only control characters / non-printable junk. Error strings are
  **Polish**. Returns the normalized `value` on success.
- `isDuplicate(name: string, skills: Skill[], excludeId?: string): boolean` —
  true when another skill shares the same `dedupKey`; `excludeId` lets an edit keep
  its own row without self-colliding.

#### 3. localStorage persistence hook

**File**: `src/components/hooks/useBaseSkills.ts` (new)

**Intent**: Own all skills state + persistence so the UI component stays
presentational. Reads the versioned envelope on mount, writes on every change,
and exposes CRUD operations that enforce validation/dedup via the Phase-1
functions.

**Contract**: `useBaseSkills()` returns `{ skills, addSkill, editSkill,
removeSkill, restoreSkill }` (exact shape at implementer's discretion), where:

- State is the `Skill[]`; mutations persist `{ version: 1, skills }` to a single
  namespaced localStorage key (e.g. `10xwork-find:base-skills`).
- The initial read **must be SSR-safe and defensive**: tolerate missing key /
  malformed JSON / wrong `version` by returning `[]` — never throw. (Even with
  `client:only`, guarding `typeof window` keeps the hook unit-testable and robust.)
- `addSkill(name)` / `editSkill(id, name)` run `validateSkillName` then
  `isDuplicate`; on failure they surface an error (return value or thrown-and-caught
  — implementer's choice) rather than mutating. New ids via `crypto.randomUUID()`.
- `removeSkill(id)` hard-deletes; `restoreSkill` re-inserts a just-removed skill
  **at its original index** (so undo is identity-preserving, not a reorder/append)
  — the undo buffer itself lives in the component.
- New skills append (insertion order preserved).

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Type check passes: `npx astro check` (`astro build` does NOT type-check — Vite strips types; `@astrojs/check` is installed for this)
- Lint passes: `npm run lint`
- Unit tests pass: `npm run test:run`
- `src/lib/services/skills.ts` has unit tests covering: empty/whitespace
  rejection; "C" and "Go" accepted (min length 1); "CI/CD", "Node.js", ".NET",
  "C++", "C#" accepted (permissive charset); >80-char rejected; case-insensitive
  trimmed dedup ("Git" vs "git " collide); `excludeId` lets an edit keep its own
  name
- `useBaseSkills` hook has a test (via `@testing-library/react`
  `renderHook`) covering: add persists to localStorage; reload reads it back;
  malformed / missing localStorage value yields an empty list without throwing

#### Manual Verification:

- None for this phase — it ships no UI. (Logic is covered by automated tests.)

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation from the human before
proceeding to Phase 2. Phase blocks use plain bullets — the corresponding
checkboxes live in the `## Progress` section.

---

## Phase 2: Skills-management UI island

### Overview

Build the React island that turns the Phase-1 hook into a usable surface — add
field, list, inline edit, delete + undo, duplicate message — and mount it at
`#app-root`. All copy Polish. Component tests cover the happy paths.

### Changes Required:

#### 1. Skills manager island

**File**: `src/components/BaseSkillsManager.tsx` (new)

**Intent**: The single interactive surface for the slice. Consumes
`useBaseSkills` and renders:

- an **add** field + button; on submit, calls `addSkill`, clears the field on
  success, and shows an **inline Polish error** on validation failure or duplicate
  (e.g. *"Ta umiejętność już istnieje"*) without adding a row;
- the **list** of skills in insertion order, each row showing the name with
  **Edit** and **Delete** actions;
- **inline edit**: Edit swaps the row label for a text input with **Save / Cancel**
  (Polish: *Zapisz / Anuluj*), applying the same validation + dedup (with
  `excludeId`); Cancel restores the original;
- **delete + undo**: Delete removes the row immediately (hard delete) and shows a
  short-lived **Cofnij** (undo) affordance that calls `restoreSkill`; the undo
  buffer + timer live here;
- an **empty state** message when there are no skills yet (Polish).

**Contract**: Presentational component holding only transient UI state (which row
is editing, current add-field text + error, pending-undo skill + timeout). All
persistence/validation goes through `useBaseSkills`. Uses `cn()` and existing
shadcn `Button`; add any further shadcn primitives via
`npx shadcn@latest add <name>` (e.g. `input`) rather than hand-rolling. Accessible
labels on inputs/buttons (the page region is `aria-label="Narzędzie"`).

#### 2. Mount the island

**File**: `src/pages/index.astro`

**Intent**: Render the island inside the existing `#app-root` section so the tool
appears on `/`.

**Contract**: Import `BaseSkillsManager` and render it with
**`client:only="react"`** inside (or as) the `#app-root` section, replacing the
empty placeholder. The page heading + subheading above it are unchanged. No other
page edits.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Tests pass: `npm run test:run`
- `BaseSkillsManager` has a `@testing-library/react` + `user-event` test covering
  the happy paths: add a skill → appears in list; edit a skill → label updates;
  delete a skill → row removed; undo (Cofnij) → row restored; adding a duplicate →
  inline error shown and no new row added

#### Manual Verification:

- Visiting `/` shows the add field, list, and (initially) the empty-state message
- Adding several skills, then reloading the page, shows the list persisted
- Closing and reopening the browser preserves the list (localStorage)
- "C" and "CI/CD" can be added; blank/whitespace input is rejected with a Polish
  message; adding "git" when "Git" exists is refused with a Polish message
- Inline edit Save persists the change; Cancel discards it
- Delete removes immediately; Cofnij restores the skill within the undo window
- No console errors; no hydration warnings (confirms `client:only` mounting)

**Implementation Note**: After completing this phase and all automated
verification passes, pause for final manual confirmation from the human.

---

## Testing Strategy

### Unit Tests:

- `src/lib/services/skills.ts` (Phase 1): validation boundaries (empty, 1-char,
  80/81-char), permissive charset acceptance of real skills, case-insensitive
  trimmed dedup, `excludeId` self-exclusion on edit.
- `useBaseSkills` (Phase 1): persistence round-trip via localStorage; defensive
  read of missing/malformed/wrong-version data → empty list, no throw.

### Integration Tests:

- `BaseSkillsManager` (Phase 2) component test exercising add → edit → delete →
  undo → duplicate-rejection through the real hook (jsdom localStorage), which is
  the end-to-end surface of this single-user slice.

### Manual Testing Steps:

1. `npm run dev`, open `/` → see add field + empty-state message.
2. Add "Java", "Git", "CI/CD", "C" → all appear in order.
3. Try to add "git" → refused with inline Polish duplicate message; try blank →
   rejected.
4. Edit "Git" → "GitHub", Save → label updates; Edit again, Cancel → unchanged.
5. Delete "Java" → row gone; click Cofnij → "Java" restored.
6. Reload the page, then fully restart the browser → list persists.
7. Open devtools console → no errors, no hydration warnings.

## Performance Considerations

Negligible — a single-user, small list (PRD `data_volume: small`) in localStorage.
No virtualization, debouncing, or memoization needed at this scale. The NFR
"output within ~1s" applies to S-02's matching, not to this CRUD.

## Migration Notes

- First run has no stored data; the hook initializes an empty list. The versioned
  envelope (`{ version: 1, skills }`) is the forward-compat seam: a future schema
  change reads the `version` and migrates, falling back to empty on anything
  unrecognized. No existing data to migrate.

## References

- Roadmap item: `context/foundation/roadmap.md` → **S-01: Manage base skills**
- PRD: `context/foundation/prd.md` → `## Functional Requirements` → "Base Skills
  Management" (FR-001–FR-004); `## Non-Functional Requirements` (data stays local);
  `## Non-Goals` (hard delete only; no other CV sections)
- Prerequisite (done): `context/changes/local-only-app-shell/plan.md` (F-01) — left
  the `#app-root` mount point in `src/pages/index.astro`
- Mount point: `src/pages/index.astro` (`<section id="app-root">`)
- Conventions: `CLAUDE.md` (path alias `@/*`, hooks in `src/components/hooks/`,
  shared types in `src/types.ts`, `cn()` from `@/lib/utils`, shadcn add command)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Persistence & domain logic

#### Automated

- [x] 1.1 Build passes: `npm run build`
- [x] 1.2 Type check passes: `npx astro check`
- [x] 1.3 Lint passes: `npm run lint`
- [x] 1.4 Unit tests pass: `npm run test:run`
- [x] 1.5 `skills.ts` unit tests cover validation boundaries, permissive charset, case-insensitive trimmed dedup, and `excludeId`
- [x] 1.6 `useBaseSkills` test covers persistence round-trip and defensive read of missing/malformed data

### Phase 2: Skills-management UI island

#### Automated

- [ ] 2.1 Build passes: `npm run build`
- [ ] 2.2 Type check passes: `npx astro check`
- [ ] 2.3 Lint passes: `npm run lint`
- [ ] 2.4 Tests pass: `npm run test:run`
- [ ] 2.5 `BaseSkillsManager` test covers add / edit / delete / undo / duplicate-rejection happy paths

#### Manual

- [ ] 2.6 `/` shows add field, list, and empty-state message
- [ ] 2.7 Added skills persist across page reload and browser restart
- [ ] 2.8 "C" and "CI/CD" accepted; blank rejected; "git" vs "Git" duplicate refused — all with Polish messages
- [ ] 2.9 Inline edit Save persists, Cancel discards; delete is immediate; Cofnij restores within the undo window
- [ ] 2.10 No console errors and no hydration warnings (confirms `client:only` mounting)
