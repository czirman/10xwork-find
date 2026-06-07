# Generate Tailored Skills Section — Plan Brief

> Full plan: `context/changes/generate-tailored-skills-section/plan.md`
> Research: `context/changes/generate-tailored-skills-section/research.md`

## What & Why

S-02 is the product's north star: paste a job posting's free-text skill requirements and get back a CV-ready
skills section drawn **only** from the user's declared base skills, expressed in the posting's vocabulary via a
curated synonym map, plus a list of posting terms that matched nothing. It is the slice that empirically tests
the core hypothesis (a hand-curated map can map ≥75% of real posting terms).

## Starting Point

S-01 shipped the foundation: `Skill {id, name}` persisted on-device, `useBaseSkills()` exposing the list, and a
`BaseSkillsManager` island mounted at `#app-root` — whose page comment already reserves the spot for "posting
matching (S-02)". No synonym map, matcher, or clipboard code exists yet. `normalize()`/`dedupKey()` exist but
ignore punctuation, so they're insufficient for matching as-is.

## Desired End State

Below the skills manager, the user pastes a posting, clicks "Generuj", and immediately sees a comma-separated
skills line (only their declared skills) with a "Kopiuj" button that copies exactly that line, plus a flat
deduplicated list of unmatched terms. Skills added in the manager are matchable without reload.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Matching location | Client-side pure module | Data-locality NFR forces it; also moots the Workers CPU cap | Research |
| Output format | Comma-separated single line | Most universal + paste-clean; simplest golden test | Plan |
| Tokenization | Hybrid (delimiter split → contains-match) | Best match rate while keeping a clean unmatched list | Plan |
| UI composition | One parent island sharing `useBaseSkills` | Newly added skills are immediately matchable; one source of truth | Plan |
| Unmatched terms | Flat deduplicated list | Matches FR-007 v1; per-match breakdown parked to v2 | Plan |
| Synonym map seed | Curated for the user's Java stack | Makes the ≥75% hypothesis actually testable | Plan |
| `matchKey` punctuation | Edge-strip, preserve `+`/`#` | Keeps `C`/`C++`/`C#` distinct (collision guard) | Research |
| Test scope | Unit tests now; ≥75% fixtures deferred | Matches the test-plan's explicit phasing | Plan |

## Scope

**In scope:** pure `matching.ts` (`matchKey`, hybrid tokenizer, classifier, output assembler); curated
`synonym-map.ts` + inverted index; parent `SkillsTool` island; refactor `BaseSkillsManager` to props; new
`PostingMatcher` UI with clipboard; remount `index.astro`; unit + component tests.

**Out of scope:** ≥75% labeled-fixture suite (deferred test phase); per-match breakdown / split unmatched list;
LLM; file download; in-app map editing; PDF/scraping input; persisting posting or output.

## Architecture / Approach

Mirror S-01's layering: pure rules in `src/lib/services/` → state hook → presentational island. A new parent
`SkillsTool` owns one `useBaseSkills` and feeds both the (refactored, props-driven) `BaseSkillsManager` and the
new `PostingMatcher`. The matcher inverts the synonym map to `matchKey(synonym) → canonical`, joins each canonical
to a declared skill by `matchKey`, and emits the user's verbatim name — guaranteeing output ⊆ declared skills.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Matching core & synonym map | Pure matcher + curated map + unit tests (no UI) | `matchKey` punctuation/collision rule; oracle-trap in tests |
| 2. Posting-matcher UI, composition & clipboard | Parent island, refactored manager, PostingMatcher, clipboard, component tests | Refactoring S-01's `BaseSkillsManager` without regressing it (Risk #6) |

**Prerequisites:** S-01 (`manage-base-skills`) done — satisfied.
**Estimated effort:** ~2 sessions across 2 phases.

## Open Risks & Assumptions

- The synonym-map seed's coverage drives the (later-measured) ≥75% rate; v1 coverage is best-effort for the
  user's anticipated stack — gaps surface as unmatched terms, which is the designed feedback loop.
- The hybrid tokenizer needs an overlap-resolution rule (union of matched canonicals); edge cases in prose
  splitting are covered by unit tests, refined as real postings reveal misses.
- Refactoring `BaseSkillsManager` to props touches shipped S-01 code; its existing tests must stay green.

## Success Criteria (Summary)

- Paste a posting → comma-separated section containing only declared skills, copyable paste-clean (FR-008)
- Unmatched posting terms shown as a flat deduplicated list (FR-007)
- Output within ~1s; nothing leaves the device; newly added skills matchable without reload
