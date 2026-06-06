# Generate Tailored Skills Section — Implementation Plan

## Overview

Build S-02, the north-star slice: paste a job posting's free-text skill requirements, classify each term
against a developer-curated synonym map, and produce a **CV-ready comma-separated skills section drawn only
from the user's declared base skills**, plus a flat list of unmatched posting terms, copyable to clipboard.
Matching runs entirely client-side (data-locality NFR), as a pure TS module composed into the existing
single-island UI.

## Current State Analysis

S-01 shipped the base-skills foundation S-02 consumes (see `research.md` for full grounding):

- `Skill { id, name }` (`src/types.ts:10`) — `name` is the documented join key for S-02 matching.
- `useBaseSkills()` (`src/components/hooks/useBaseSkills.ts:71`) owns the list + localStorage; exposes `skills`.
- `BaseSkillsManager` (`src/components/BaseSkillsManager.tsx`) is the S-01 island, mounted `client:only="react"`
  at `#app-root` (`src/pages/index.astro:14-15`); the page comment already says *"posting matching (S-02) follows."*
- `normalize()` / `dedupKey()` (`src/lib/services/skills.ts:23-30`) handle case + whitespace **but not
  punctuation** — confirmed `dedupKey("Git.") ≠ dedupKey("Git")`. They must not be mutated (S-01 depends on them).
- Test stack: Vitest 4.1 + jsdom + `@testing-library/react` (`vitest.config.ts`, `src/test/setup.ts`).
- **No synonym map, matcher, or clipboard code exists** anywhere yet.

## Desired End State

The user opens the app, sees the S-01 skills manager and a new posting area below it. They paste a posting,
click "Generuj", and immediately see (a) a comma-separated skills line built only from their declared skills
expressed via the synonym map, with a "Kopiuj" button that puts exactly that line on the clipboard, and (b) a
flat deduplicated list of posting terms that matched nothing. Newly added skills are matchable without reload.
Verify: `npm run build`, `npm run lint`, `npx astro check`, and `npm run test:run` all pass; manual paste of a
real Java posting yields a sensible section + unmatched list within ~1s.

### Key Discoveries:

- **Client-side matching is forced** by the data-locality NFR/Risk #5 — and it moots the Workers 10ms CPU cap
  (`research.md` keystone). Keep the matcher free of Node built-ins (`path`, etc.).
- **Subset invariant has a clean construction** (Risk #3): invert map to `matchKey(synonym) → canonical`, join
  canonical to a declared `Skill` by `matchKey`, **emit the declared skill's verbatim `name`**.
- **`matchKey` must preserve `+` and `#` at term edges** or `C`, `C++`, `C#` collapse to the same key
  (collision hazard — see Critical Implementation Details).
- **Two islands would drift** (`research.md` finding #6): a separate S-02 island calling `useBaseSkills` holds
  independent state over the same key. The hook must be lifted to one parent island.

## What We're NOT Doing

- **No ≥75% labeled-fixture suite** — deferred to the test-plan's "matching-engine correctness" phase
  (added via `/10x-test-plan --refresh` after this ships). This slice ships unit tests only.
- **No per-match breakdown and no split (map-gap vs skill-gap) unmatched list** — v2 (roadmap §Parked). v1 is
  one flat deduplicated unmatched list (FR-007).
- **No LLM / scoring** — rule-based synonym map only (PRD §Non-Goals).
- **No download (.txt/.docx)** — clipboard only (FR-008).
- **No in-app synonym-map editing** — the map is a developer-curated source file (`shape-notes.md:48`).
- **No PDF/scraping input** — manual paste only.
- **No persistence of posting text or generated output** — both are transient per session.
- **Not redesigning `Layout.astro` or the page header** — only the `#app-root` mount changes.

## Implementation Approach

Mirror S-01's proven layering: pure rules in `src/lib/services/` (unit-tested, no I/O) → state in a hook →
presentational island. S-02 adds a pure `matching.ts` + a data-only `synonym-map.ts`, then composes a new
`PostingMatcher` and the existing `BaseSkillsManager` under one parent `SkillsTool` island that owns a single
`useBaseSkills` instance. Output ordering is the user's declared-list order (deterministic golden test).

## Critical Implementation Details

- **`matchKey` collision guard.** `matchKey` extends `dedupKey` (trim → collapse whitespace → lowercase) by
  stripping **leading/trailing** characters that are neither alphanumeric **nor in the preserve-set `{+, #}`**.
  This makes `"Git."`→`"git"` while keeping `"C++"`→`"c++"`, `"C#"`→`"c#"`, `"C"`→`"c"` distinct. Because only
  *edges* are stripped, internal punctuation survives: `"Node.js"`→`"node.js"`, `"CI/CD"`→`"ci/cd"`. Stripping
  all non-alphanumerics (the naive approach) would collapse `C`/`C++`/`C#` and is the bug to avoid.
- **Single hook instance.** `useBaseSkills` is called exactly once, in `SkillsTool`. Both children receive their
  data from that instance (props). Do not let `PostingMatcher` or the refactored `BaseSkillsManager` call
  `useBaseSkills` themselves — two instances over one storage key drift silently.
- **Clipboard availability.** `navigator.clipboard.writeText` exists only in the browser/secure context; it lives
  in the `client:only` island. Wrap in try/catch; on failure show a Polish fallback message rather than throwing.
- **Do not mutate `normalize()` / `dedupKey()`** — S-01 validation/dedup and its tests depend on current
  behavior (Risk #6). `matchKey` is additive.

## Phase 1: Matching core & synonym map

### Overview

Pure, UI-independent matching logic plus the curated synonym map and its inverted index, fully unit-tested.
Nothing is mounted, so the build stays green.

### Changes Required:

#### 1. Match-key normalization tier

**File**: `src/lib/services/matching.ts`

**Intent**: Add the punctuation-tolerant `matchKey` that the matching layer compares on, without touching the
S-01 primitives.

**Contract**: `export function matchKey(name: string): string`. Builds on `dedupKey` from `skills.ts`, then
strips leading/trailing chars that are not `[\p{L}\p{N}]` and not in `{+, #}`. Preserve-set and edge-only
stripping are the contract (see Critical Implementation Details).

#### 2. Posting tokenizer + matcher

**File**: `src/lib/services/matching.ts`

**Intent**: Tokenize free-text posting (hybrid strategy), classify each candidate term to declared skills via the
inverted synonym index, and assemble the CV-ready output + unmatched list.

**Contract**:
```ts
export interface MatchResult {
  section: string;     // matched declared-skill names, declared-list order, deduped, joined by ", "
  matched: Skill[];    // ⊆ the declared skills passed in (subset invariant)
  unmatched: string[]; // distinct posting terms (first-seen casing) with no declared-skill match
}
export function matchPosting(skills: Skill[], postingText: string, map?: SynonymMap): MatchResult;
```
- **Tokenize**: split on newlines, commas, semicolons, pipes, bullets (`• * – -` at boundaries), parens/brackets;
  do **not** split on `/ + # .` (internal to `CI/CD`, `C++`, `C#`, `Node.js`). Trim, drop empties.
- **Classify (hybrid)**: for each candidate term, try exact inverted-index lookup by `matchKey`; if no exact hit,
  do whole-word contains-matching of known synonym phrases within the term (so "knowledge of Git" resolves "Git").
  Union all resulting canonicals; a term is unmatched only if it yields zero declared-skill matches.
- **Join**: a canonical resolves to a declared skill when `matchKey(canonical) === matchKey(skill.name)`; output
  the declared skill's verbatim `name`. A canonical with no declared skill → its term is unmatched (skill-gap).
- **Output**: `section` = matched declared names in declared-list order, deduped, `", "`-joined; `""` when none.

#### 3. Curated synonym map + inverted index

**File**: `src/lib/services/synonym-map.ts`

**Intent**: Ship the developer-curated map seeded for the user's Java/backend stack, plus a load-time inverted
index for O(1) lookup.

**Contract**: `export type SynonymMap = Record<string, string[]>` (canonical skill → synonym phrasings).
`export const SYNONYM_MAP: SynonymMap`. `export const SYNONYM_INDEX: Map<string, string>` built once via
`matchKey` over every synonym **and** each canonical itself (so the canonical matches its own name). Seed scope:
common Java/backend posting vocabulary — e.g. Java, Spring/Spring Boot, Hibernate/JPA, REST, SQL/relational DB,
Git/version control/VCS, Docker/containers, Kubernetes/k8s, CI/CD, Maven, Gradle, JUnit, Kafka, microservices —
each with the phrasings real postings use. Implementer authors the entries; canonicals chosen to join the user's
likely declared names.

#### 4. Unit tests

**File**: `src/lib/services/matching.test.ts` (+ a small fixture map inside the test, independent of the shipped
seed, to avoid the oracle trap)

**Intent**: Lock Risks #2, #3, #7 and core matching behavior.

**Contract**: cover — `matchKey` equivalence classes (`"Git"`/`" git "`/`"GIT"`/`"Git."` equal; `"C++"`≠`"C"`≠`"C#"`;
`"Node.js"`/`"CI/CD"` internal punctuation preserved); tokenization (delimiters, bullets, prose-embedded terms);
classification (matched + unmatched on the fixture map); **subset invariant** (matched ⊆ declared, asserted
against the independent declared set, not the matcher's own output); **output format golden** (exact comma-joined
order); empty/no-match inputs.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Unit tests pass: `npm run test:run`
- `matching.test.ts` covers matchKey equivalence classes, hybrid tokenization, matched/unmatched classification, the output⊆declared invariant, and the golden output format

#### Manual Verification:

- A handful of representative Java posting snippets, run through `matchPosting` in a scratch test, produce sensible matched/unmatched splits

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Posting-matcher UI, island composition & clipboard

### Overview

Lift `useBaseSkills` into a parent island shared by a refactored `BaseSkillsManager` and a new `PostingMatcher`,
wire the generate → output → copy flow, and remount the page. All copy Polish.

### Changes Required:

#### 1. Parent island owning shared state

**File**: `src/components/SkillsTool.tsx`

**Intent**: Single owner of `useBaseSkills`, rendering both children so the matcher always sees the live list.

**Contract**: calls `useBaseSkills()` once; renders `<BaseSkillsManager {...skillsApi} />` and
`<PostingMatcher skills={skills} />`. Default export; this is the only island mounted at `#app-root`.

#### 2. Refactor S-01 manager to receive state via props

**File**: `src/components/BaseSkillsManager.tsx` (+ `src/components/BaseSkillsManager.test.tsx`)

**Intent**: Stop calling `useBaseSkills` internally; accept the skills API as props so one hook instance is shared.
Preserve all existing behavior (add/edit/delete/undo, Polish copy, a11y).

**Contract**: new props interface `{ skills, addSkill, editSkill, removeSkill, restoreSkill }` (the `UseBaseSkills`
shape). Transient UI state (add/edit/undo) stays internal. Update its test to render via a small harness that
provides the real `useBaseSkills` (or `SkillsTool`), keeping the same assertions green (Risk #6 watch).

#### 3. Posting matcher UI

**File**: `src/components/PostingMatcher.tsx`

**Intent**: The S-02 surface — paste posting, generate, show + copy the CV-ready section and the unmatched list.

**Contract**: props `{ skills: Skill[] }`. A Polish-labeled `<textarea>` + "Generuj" button; on submit calls
`matchPosting(skills, text)`. Renders: the comma-separated `section` in a read-only region with a "Kopiuj" button
(`navigator.clipboard.writeText(section)`, try/catch, Polish `role="status"` success/fallback); the flat unmatched
list under a Polish heading; empty states — no declared skills, empty posting (inline message), and no-match
(message instead of an empty copy). Reuse shadcn `Button`; match the `role="alert"`/`role="status"` + `aria-label`
conventions from `BaseSkillsManager`.

#### 4. Remount the page

**File**: `src/pages/index.astro`

**Intent**: Mount the single parent island instead of `BaseSkillsManager` directly.

**Contract**: import and render `<SkillsTool client:only="react" />` inside `#app-root`; drop the direct
`BaseSkillsManager` import. Header/subheading unchanged.

#### 5. Component tests

**File**: `src/components/PostingMatcher.test.tsx`

**Intent**: Cover the generate/copy/unmatched/empty flows and the exact clipboard payload (Risk #7).

**Contract**: render with a seeded `skills` array; paste a posting, click Generuj, assert the rendered section and
unmatched list; mock `navigator.clipboard.writeText` and assert it receives the **exact** section string; assert
the three empty/no-match states.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- All tests pass: `npm run test:run` (including the still-green refactored `BaseSkillsManager.test.tsx`)
- `PostingMatcher.test.tsx` asserts the clipboard payload equals the exact generated section string

#### Manual Verification:

- Paste a real Java posting → matched section is comma-separated, contains only declared skills, copy is paste-clean
- Unmatched terms appear as a flat deduplicated list
- Adding a new skill in the manager makes it immediately matchable without reload (shared-state proof)
- Empty posting, no-declared-skills, and no-match states each show their Polish message; no console/hydration errors

**Implementation Note**: After automated verification passes, pause for manual confirmation before closing the change.

---

## Testing Strategy

### Unit Tests:

- `matchKey` equivalence classes (Risk #2) incl. the `C`/`C++`/`C#` collision guard and internal-punctuation preservation
- Hybrid tokenization (delimiters, bullets, prose-embedded terms)
- Classification on an independent fixture map (matched + unmatched); subset invariant (Risk #3); golden output (Risk #7)

### Integration Tests:

- `PostingMatcher` generate → render → copy flow with `@testing-library/react`; clipboard payload assertion
- Shared-state proof: skill added via manager is matchable by the matcher in the same mounted tree

### Manual Testing Steps:

1. Paste a real Java posting; confirm matched section is paste-clean and contains only declared skills
2. Confirm unmatched terms are a flat deduplicated list
3. Add a skill, immediately generate, confirm it now matches (no reload)
4. Test empty posting, no declared skills, and a no-match posting → correct Polish messages

## Performance Considerations

Pure client-side string work over a few hundred terms — trivially within the <1s NFR; no network, no Worker
round-trip. Inverted index built once at module load. Keep the matcher free of Node built-ins so a future
dependency can't reintroduce the `path.posix` Workers bug noted in `infrastructure.md`.

## Migration Notes

None — no data model change. `SkillsStore`/`STORAGE_KEY` untouched; S-02 only reads `skills`.

## References

- Research: `context/changes/generate-tailored-skills-section/research.md`
- S-01 patterns: `src/lib/services/skills.ts`, `src/components/hooks/useBaseSkills.ts:71`, `src/components/BaseSkillsManager.tsx`
- Test patterns: `context/archive/2026-06-04-testing-base-skills-crud/`
- Test-plan risks: `context/foundation/test-plan.md` §2 (#1, #2, #3, #7), §6.4–6.5 (deferred phases)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Matching core & synonym map

#### Automated

- [x] 1.1 Build passes: `npm run build`
- [x] 1.2 Type check passes: `npx astro check`
- [x] 1.3 Lint passes: `npm run lint`
- [x] 1.4 Unit tests pass: `npm run test:run`
- [x] 1.5 `matching.test.ts` covers matchKey equivalence classes, hybrid tokenization, matched/unmatched classification, the output⊆declared invariant, and the golden output format

#### Manual

- [ ] 1.6 Representative Java posting snippets produce sensible matched/unmatched splits via `matchPosting`

### Phase 2: Posting-matcher UI, island composition & clipboard

#### Automated

- [ ] 2.1 Build passes: `npm run build`
- [ ] 2.2 Type check passes: `npx astro check`
- [ ] 2.3 Lint passes: `npm run lint`
- [ ] 2.4 All tests pass: `npm run test:run` (including refactored `BaseSkillsManager.test.tsx`)
- [ ] 2.5 `PostingMatcher.test.tsx` asserts the clipboard payload equals the exact generated section string

#### Manual

- [ ] 2.6 Real Java posting → comma-separated section, only declared skills, paste-clean copy
- [ ] 2.7 Unmatched terms render as a flat deduplicated list
- [ ] 2.8 Newly added skill is immediately matchable without reload (shared-state proof)
- [ ] 2.9 Empty-posting, no-declared-skills, and no-match states each show their Polish message; no console/hydration errors
