---
date: 2026-06-06T17:09:02+02:00
researcher: Claude (Opus 4.8)
git_commit: 496e1c0ed539ae00a0588a4de6a4785ee023e16e
branch: S-02
repository: 10xwork-find
topic: "S-02 generate-tailored-skills-section — codebase grounding for the matching engine"
tags: [research, codebase, matching-engine, synonym-map, clipboard, s-02]
status: complete
last_updated: 2026-06-06
last_updated_by: Claude (Opus 4.8)
---

# Research: S-02 `generate-tailored-skills-section` — grounding the matching engine

**Date**: 2026-06-06T17:09:02+02:00
**Researcher**: Claude (Opus 4.8)
**Git Commit**: 496e1c0ed539ae00a0588a4de6a4785ee023e16e
**Branch**: S-02
**Repository**: 10xwork-find

## Research Question

How does S-02 (`generate-tailored-skills-section`) plug into the existing codebase, and what does the
current code + foundation docs tell us about the four things that have **no code yet**: the synonym-map
source of truth, the matching + normalization algorithm, the CV-ready output format, and the clipboard
copy? Ground each against the live code and the risks the test-plan flags (Risks #1, #2, #3, #7).

## Summary

S-02 is **greenfield-within-the-repo**: the matching engine, synonym map, and output assembler do not
exist. But the seams it must plug into are fully built by S-01 and stable.

Eight load-bearing findings:

1. **Matching runs client-side, in the browser island** — forced by the data-locality NFR/Risk #5 ("no
   posting content leaves the device"). This is the single most consequential architectural fact: it
   means the matcher is a pure TS module bundled into a `client:only="react"` island, **and it neutralizes
   the Cloudflare Workers 10 ms CPU cap** that `infrastructure.md` worried about (that risk assumed
   server-side matching). Do not over-engineer matching for the edge.
2. **The join contract already exists**: `Skill { id, name }` (`src/types.ts:10`), where `name` is
   explicitly documented as *"the join key S-02 matches against postings."*
3. **Normalization primitives exist but are insufficient for matching.** `normalize()` and `dedupKey()`
   (`src/lib/services/skills.ts:23,28`) handle case + whitespace but **not punctuation** — `"Git."` ≠
   `"Git"` under `dedupKey` (empirically confirmed). Risk #2 explicitly names trailing punctuation, so a
   **separate matching key is needed**; reusing `dedupKey` as-is fails the punctuation equivalence class.
   Do **not** mutate the shared `normalize()` (S-01 dedup/validation depends on it → Risk #6).
4. **Synonym map = developer-maintained config file** (decided in `shape-notes.md:48`: *"stored as a
   config file, edited by the developer"*). It is NOT UI-editable and NOT in localStorage. Recommended
   home: a typed TS module under `src/lib/` so it is type-checked, bundled client-side, and importable by
   both matcher and tests.
5. **Subset invariant has a clean construction** (Risk #3): invert the map to `synonym → canonical`, join
   the canonical to the user's declared list by match-key, and **emit the user's verbatim `name`**. Output
   is then provably a subset of declared skills — never a posting term, never a map key.
6. **Two independent islands would NOT share state.** S-01's `BaseSkillsManager` and a separate S-02
   island would each call `useBaseSkills()` and hold independent React state over the same localStorage
   key; a write in one is invisible to the other until reload (no `storage` event listener exists).
   Compose both under one parent island (one `useBaseSkills` instance) or re-read on Generate.
7. **The output format is undefined** — PRD/US-01 say only "formatted skills section." Risk #7's golden
   test cannot be written until this is locked. Open question for `/10x-plan` + Socratic.
8. **No clipboard code exists anywhere** (`grep` clean). `navigator.clipboard.writeText` is new surface;
   needs a fallback/availability guard and is only reachable in the `client:only` island.

## Detailed Findings

### Area 1 — Integration seams (how S-02 plugs in)

**Data contract (the join key).** `src/types.ts:9-25`:
- `Skill { id: string; name: string }`. `name` is the user's verbatim text and the documented join key.
- `SkillsStore { version: 1; skills: Skill[] }` — the persisted envelope.

**Reading the user's list.** `src/components/hooks/useBaseSkills.ts`:
- `STORAGE_KEY = "10xwork-find:base-skills"` (`:7`); envelope written as `{ version: 1, skills }` (`:60`).
- The hook exposes `skills: Skill[]` (`:72`) plus CRUD. S-02 only needs **read** access to `skills`.
- Defensive read (`readStore`, `:31-55`) tolerates missing/corrupt/wrong-version data → `[]`. SSR-safe via
  `typeof window === "undefined"` guards — but S-02's matcher should be a **pure function** that *receives*
  the skills array, not one that reads storage itself (keeps it unit-testable, mirrors `skills.ts`).

**Mount point.** `src/pages/index.astro`:
- `<section id="app-root" aria-label="Narzędzie">` (`:14`) currently holds `<BaseSkillsManager client:only="react" />` (`:15`).
- Line 13 comment: *"Base-skills management (S-01) mounts here; posting matching (S-02) **follows**."* —
  the page already anticipates S-02 in this section.
- **Integration decision needed** (see Finding #6): add a second island vs. compose into one parent. The
  page header + Polish subheading (`:9-10`) already frame the tool ("Wklej wymagania z oferty pracy…").

**UI conventions to match** (from `src/components/BaseSkillsManager.tsx`):
- shadcn `Button` / `Input` from `@/components/ui/*` (`:3-4`); class merge via `cn()` (`src/lib/utils.ts`).
- **All copy is Polish.** Errors render inline as `<p role="alert" className="text-destructive text-sm">`
  (`:111-115`); transient status as `role="status"` (`:118-128`). No toast library — inline messages only.
- Accessibility: `aria-label` on inputs/buttons, `aria-invalid` on error (`:105-106`).
- Note: `Layout.astro` sets `<html lang="en">` while copy is Polish — a pre-existing inconsistency, out of
  scope for S-02.

**Test stack** (`vitest.config.ts`, `package.json`): Vitest 4.1.x + jsdom + `@testing-library/react` +
`user-event` + `jest-dom` (`src/test/setup.ts`). Runners: `npm run test:run`, `npm run test:coverage`.
Pure-logic tests live beside source in `src/lib/services/*.test.ts`; hook/DOM tests in `src/components/**`.

### Area 2 — Synonym-map source of truth (Risk #1)

**Prior decision (binding).** `context/foundation/shape-notes.md:48` and `:65`: the synonym map is a
**curated config file edited by the developer**, outside the app UI. `context/archive/2026-05-31-manage-base-skills/plan.md:71-72`
reaffirms: *"Not building the synonym map … developer-maintained and consumed by S-02."* So S-01
deliberately left this to S-02. There is **no existing map file** in the repo today.

**Recommended representation** (decision for `/10x-plan`, options laid out):
- **Option A — typed TS module** under `src/lib/` (e.g. `src/lib/services/synonym-map.ts`) exporting a
  typed structure. Pros: type-checked, bundled into the client island automatically, importable by tests,
  no fetch (data-locality safe), no JSON-parse at runtime. **Recommended.**
- **Option B — JSON file** imported at build time. Pros: editing doesn't touch code. Cons: weaker typing,
  still needs a typed loader. Functionally similar once bundled.
- Avoid: anything fetched at runtime (violates data-locality) or stored in localStorage (it's
  developer-curated, not user data).

**Shape**: author it as `canonical skill → [synonym phrasings]`, then build an **inverted index**
`matchKey(synonym) → canonical` at module load for O(1) lookup. The canonical names should be authored to
join cleanly to the *user's likely declared names* by match-key (Finding #3/#5).

**Oracle trap (Risk #1, must avoid).** Expected matches for the ≥75% fixture test must **not** be derived
from the map under test — that is tautological. The human-labeled posting fixtures + their expected
canonical matches must live **independent of `synonym-map.ts`** (e.g. `src/test/fixtures/postings/*` with
hand-labeled expectations). State this location in the plan so the measured match-rate is a real signal.

### Area 3 — Matching + normalization (Risks #2, #3)

**Normalization (Risk #2) — the sharp finding.** Reusing the S-01 keys as-is is a trap:
- `dedupKey()` = `trim → collapse whitespace → lowercase` (`skills.ts:28-30`). It does **not** strip
  punctuation. Empirically: `dedupKey("Git.") = "git."` ≠ `dedupKey("Git") = "git"`.
- Risk #2 explicitly requires that inputs differing only by **trailing punctuation** still match.
- **Recommendation:** introduce a dedicated `matchKey()` for the matching layer that extends `dedupKey`
  with **leading/trailing** punctuation stripping, while **preserving internal tech punctuation**
  (`CI/CD`, `Node.js`, `.NET`, `C++`, `C#`). Naive `.replace(/[^\p{L}\p{N}]/gu,"")` would destroy
  `Node.js` → flag this nuance for the plan. Do **not** modify `normalize()`/`dedupKey()` — S-01's
  validation/dedup and its tests depend on current behavior (mutating them risks an S-01 regression, Risk #6).

**Tokenization — the central open design question (for `/10x-plan` + Socratic).** Postings are free text
("Strong knowledge of Git, Docker and CI/CD pipelines; familiarity with Kubernetes"). Two strategies, in
tension because FR-006 (match rate) and FR-007 (enumerate unmatched terms) pull different ways:
- **Exact-term lookup** — split posting on delimiters (commas, newlines, semicolons, bullets) into
  candidate terms, `matchKey` each, look up in the inverted index. Clean unmatched-term enumeration for
  FR-007, but misses terms embedded in prose ("knowledge of VCS" won't equal synonym "vcs").
- **Phrase-contains scan** — scan the normalized posting text for each known synonym phrase as a
  whole-word match. Catches embedded terms (better FR-006), but makes "what is an unmatched *term*?"
  ambiguous (FR-007 needs a term inventory to call something unmatched).
- **Likely answer: a hybrid** — delimiter-tokenize to get the candidate-term inventory (drives FR-007),
  and within each candidate term do containment matching against the synonym index (helps FR-006). Cost is
  O(terms × synonyms), trivially within the <1 s NFR client-side. **Present as options; do not pre-decide.**

**Subset invariant (Risk #3) — clean construction.** For each posting term: `matchKey` → inverted-index →
canonical → find the user `Skill` whose `matchKey(name)` equals the canonical's key → **output that
Skill's verbatim `name`**. Because output elements are pulled from `skills` (the declared list), the result
is provably `⊆ declared skills` — never a posting term, never a map key. This directly answers the
"no invented skills" guardrail and Risk #3. The invariant test must assert against the **independent**
declared-skills set, not the assembler's own output.

**Two causes of "unmatched" (FR-007) — make explicit.** A posting term is "unmatched" for two different
reasons, both surfacing in the same list but meaning different things:
- (a) **map gap** — no synonym-map entry exists for the term at all (developer should extend the map).
- (b) **skill gap** — the term maps to a canonical skill the user has *not declared* (genuine missing
  skill, not a map problem).
The plan should decide whether v1 distinguishes these or lumps them (FR-007 v1 = informational list only;
per-term breakdown is parked to v2, roadmap §Parked). Fixture labeling needs this distinction to be
unambiguous.

### Area 4 — Output format + clipboard (Risk #7, FR-008)

**Format is undefined — open question.** PRD/US-01 (`prd.md:53,58`) say only "formatted skills section…
CV-ready." Success Criteria §Secondary demands "no cleanup needed before pasting." There is **no format
spec** anywhere. Candidates to resolve with the user: single comma-joined line (`Java, Git, Docker`); a
labeled line (`Umiejętności: …`); newline-per-skill; or grouped. **Risk #7's golden-format test is
un-writable until this is locked** — call it out as the first thing `/10x-plan` must pin via Socratic.

**Clipboard (FR-008).** No clipboard code exists (`grep -rin 'clipboard\|writeText' src/` → empty). Plan
for `navigator.clipboard.writeText`:
- Only available in the browser → lives in the `client:only` island (already the case).
- Needs an availability/permission guard + a fallback path (older/non-secure contexts), and a Polish
  success affordance consistent with the `role="status"` pattern (`BaseSkillsManager.tsx:118`).
- Risk #7 test asserts the **exact payload** handed to `writeText`, not merely that it was called.

**<1 s NFR.** Trivially met: pure client-side string work over a few hundred terms. No network, no Worker
round-trip. The data-locality requirement that *forces* client-side matching is what *guarantees* the
latency budget — they reinforce each other.

## Code References

- `src/types.ts:9-25` — `Skill { id, name }` join contract + `SkillsStore` envelope.
- `src/lib/services/skills.ts:23-30` — `normalize()` / `dedupKey()` (case+whitespace only; **no punctuation**).
- `src/lib/services/skills.ts:62-65` — `isDuplicate` (match-key join pattern to mirror).
- `src/components/hooks/useBaseSkills.ts:7,31-65,72` — storage key, defensive read/write, `skills` accessor.
- `src/components/BaseSkillsManager.tsx:95-194` — UI conventions: Polish copy, `role="alert"`/`role="status"`, shadcn Button/Input, aria-labels.
- `src/pages/index.astro:13-15` — `#app-root` mount; the "S-02 follows" comment; `client:only="react"`.
- `src/lib/utils.ts` — `cn()` class-merge helper.
- `vitest.config.ts` / `src/test/setup.ts` — jsdom + RTL test harness.

## Architecture Insights

- **Data-locality is the load-bearing constraint**, not a checkbox: it forces client-side matching, which
  (a) makes the matcher a pure bundled TS module, (b) guarantees the <1 s NFR, and (c) moots the Workers
  CPU cap. One constraint resolves three concerns.
- **Mirror the S-01 layering**: pure rules in `src/lib/services/` (unit-tested, no I/O) → state/effects in a
  hook → presentational island. S-02 should follow the same split: `matcher.ts` (pure) + `synonym-map.ts`
  (data) + a generate UI island, with the parent composing `useBaseSkills`.
- **Match-key, not dedup-key**: the project already separates "stored canonical form" (`normalize`) from
  "comparison key" (`dedupKey`). S-02 adds a third tier — "match key" — extending dedup with punctuation
  tolerance. Keep the three distinct; don't collapse them.

## Historical Context (from prior changes)

- `context/foundation/shape-notes.md:48,63-65,108` — synonym map decided as a developer-edited config file;
  LLM matching deferred to v2 to fit the ~3-week after-hours budget.
- `context/archive/2026-05-31-manage-base-skills/plan.md:71-72` — S-01 deliberately scoped the synonym map
  OUT; `name` was designed as the S-02 join key.
- `context/archive/2026-06-04-testing-base-skills-crud/` — Phase-1 test patterns (real localStorage
  round-trip, no over-mocking, edge-cases mandatory) to reuse for S-02's tests.
- `context/foundation/infrastructure.md:74,84-86,122` + `deployment/deploy-plan.md:122` — Workers free-tier
  10 ms CPU cap + a past `path.posix.normalize` import bug. **Reconciliation:** these assumed server-side
  matching; client-side matching (forced by data-locality) sidesteps the cap. Still worth a note: keep the
  matcher free of Node built-ins (`path`, etc.) so a future SSR move or dependency doesn't reintroduce the bug.

## Related Research

- `context/foundation/test-plan.md` §2 (Risks #1, #2, #3, #7) and §6.4–6.5 (deferred matching/output
  cookbook entries) — the test-plan already reserves the slots S-02 will fill via `/10x-test-plan --refresh`.

## Open Questions

1. **Output format spec** (blocks Risk #7 golden test). What exact CV-ready string? → `/10x-plan` + Socratic
   + user. *Highest priority — pins the golden test.*
2. **Tokenization strategy** — exact-term lookup vs phrase-contains scan vs hybrid (FR-006 ↔ FR-007 tension).
   → `/10x-plan` + Socratic.
3. **`matchKey` punctuation rules** — strip leading/trailing punctuation while preserving internal tech
   punctuation (`Node.js`, `C++`, `C#`, `CI/CD`). Exact rule to be specified + unit-tested.
4. **UI composition** — single parent island sharing one `useBaseSkills`, vs second island re-reading on
   Generate. Affects whether newly-added skills are matchable without reload.
5. **Unmatched-term semantics** — does v1 distinguish "map gap" vs "skill gap", or show one flat list?
   (Per-match breakdown is parked to v2 per roadmap; confirm v1 is the flat informational list of FR-007.)
6. **Synonym-map representation** — TS module (recommended) vs JSON; and the initial seed scope (which
   skills/synonyms ship in v1 to clear the ≥75% bar on real postings).
7. **Fixture location** — where the human-labeled posting fixtures + expected matches live, kept independent
   of the map to avoid the oracle trap (Risk #1).
