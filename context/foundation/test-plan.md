# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-02

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression. This product is rule-based and deterministic — a golden
   or property test almost always beats a heavier layer.
2. **User concerns are first-class evidence.** Risks anchored in "the
   builder is worried about X, and the failure would surface somewhere in
   the matching or persistence path" carry the same weight as PRD lines or
   hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/lib/services/`,
`src/components/`, `src/components/hooks/`. The 30-day auth churn
(`src/components/auth/`, `src/pages/auth/`) is excluded — it is the
*removal* of the unwanted Supabase auth scaffold by F-01, not forward
feature work, so it is not treated as likelihood evidence.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|--------------------------|--------|------------|--------------------------------|
| 1 | A previously-matching synonym stops matching (regression), or the measured match rate on a labeled fixture set silently drops below the ≥75% bar — the tailored skills section understates the candidate and the core hypothesis looks falsely dead | High | High | PRD §Success Criteria + FR-006; roadmap north-star S-02; interview Q1 |
| 2 | Normalization mismatch (case / whitespace / punctuation / duplicate terms) makes semantically equal skills compare unequal, producing spurious unmatched terms | High | High | interview Q2 (documented past burn); FR-006 |
| 3 | The generated skills section contains a skill the user never declared — an invented-skills guardrail breach that puts a false claim on the CV | High | Medium | PRD §Guardrails ("no invented skills"); US-01 acceptance criteria; interview Q4 |
| 4 | The base-skills list is lost or silently corrupted across sessions, so the user must re-enter everything | High | Medium | FR-004; hot-spot dir `src/lib/services/` and `src/components/hooks/` (forward churn) |
| 5 | Saving or loading skills triggers a network request carrying skill or posting data off-device — e.g. accidental reintroduction of the removed Supabase client or a stray `fetch` | High | Low | PRD §NFR ("data stays local") + §Guardrails ("data stays local"); roadmap baseline (Supabase scaffold present-and-removed by F-01) |
| 6 | A CRUD operation corrupts the list — duplicate skill, empty/whitespace skill accepted, edit collides, or delete removes the wrong item | Medium | Medium | FR-001 / FR-002 / FR-003; hot-spot dir `src/components/` (forward churn) |
| 7 | The generated output is not CV-ready / the clipboard copy is malformed, so the user must clean it up before pasting | Medium | Medium | FR-008; PRD §Success Criteria (secondary); US-01 acceptance criteria; interview Q3 |

Risks #1, #2, #3 and #7 target the `generate-tailored-skills-section`
(S-02) slice, which is `proposed` in the roadmap and not yet in the tree —
they are forward-looking and become testable once S-02 ships (see §3
deferred note). Risks #4, #5 and #6 target shipped code and drive the
active rollout.

**Impact × Likelihood rubric.** Both axes scored High / Medium / Low so two
readers agree on the same row.

| Rating | Impact | Likelihood |
|--------|--------|------------|
| High   | user loses access, data, or trust (false CV claim); guardrail breach; publicly visible | area changes weekly, or we have already been burned here |
| Medium | feature degrades, a workaround exists | touched occasionally, has been a source of bugs |
| Low    | cosmetic, easily reverted, no data effect | stable code, rarely touched |

Risk #5 is High-impact × Low-likelihood. Unlike a cloud-provider outage
(which belongs to observability, not a test), this one is cheaply testable
today via network interception, so it earns a test rather than a monitoring
note.

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | A fixed set of known should-map synonyms still maps after a change (regression guard), AND the measured match rate on a human-labeled posting-fixture set stays ≥75% | "The map looks complete." Also: deriving expected matches *from the synonym map itself* | The match entry point, the synonym-map source of truth, where the fixture/labeled expectations should live | unit (regression set) + characterization (labeled fixtures) | Oracle problem — expected matches lifted from the map under test, making the assertion tautological |
| #2 | Inputs differing only by case / surrounding whitespace / trailing punctuation / duplication still resolve to the same match | "Equal-looking strings compare equal." Hidden Unicode / locale casing | The normalization step and exactly which transforms it applies before lookup | unit (equivalence classes) | Snapshotting `normalize()` output (mirrors the implementation rather than asserting the rule) |
| #3 | For arbitrary inputs, the output set is a strict subset of the user's declared base skills — never a posting term, never a synonym-map key | "Happy-path output looks right, so it's always a subset." | The output-assembly step and where the declared-skills set originates | unit / property (invariant test) | Asserting against the assembler's own output instead of the independent declared-skills set |
| #4 | After a write + reload (or a simulated restart), the list reads back identical; malformed or absent stored data degrades safely instead of crashing or wiping. *Exception:* stored data with an **unknown/future** schema `version` is **intentionally** discarded (start-fresh) per the 2026-06-04 decision — a deliberate breaking-change tripwire, not a wipe of valid current data | "It wrote, so it'll read back." "A happy reload implies corruption-resilience." | The persistence read/write path, the storage key + serialization shape, version/schema handling | integration (real storage round-trip) | Over-mocking the storage layer so the real serialization is never exercised |
| #5 | Performing CRUD makes zero network requests that carry skill or posting data off-device | "No backend means nothing can leak." (The removed Supabase fetch client could be reintroduced) | Where persistence actually writes; any retained Supabase/HTTP imports reachable at runtime | integration (network spy / interception) | Asserting "Supabase is not imported" statically instead of asserting runtime no-network behavior |
| #6 | Add rejects empty/whitespace and duplicates; edit targets only the intended item; delete removes only the intended item | "The happy add path covers it." | The CRUD operations and their uniqueness / validation rules | unit / integration | Happy-path-only (add one, assert present) with no collision / dedupe / empty cases |
| #7 | The copied string matches the declared CV-ready format exactly (no cleanup needed), and the clipboard receives that exact payload | "It rendered, so it's paste-clean." | The output-format spec, the assembly step, the clipboard call site | unit (golden format) + integration (clipboard payload) | Meaningless snapshot; asserting `writeText` was called without checking the payload |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right; the orchestrator updates Status
as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|----------------|------------|--------|---------------|
| 1 | Base-skills persistence & CRUD integrity | Prove the saved list survives reloads and that add/edit/delete keep it valid | #4, #6 | unit + integration | complete | context/changes/testing-base-skills-crud/ |
| 2 | On-device data-locality guard | Prove CRUD makes no network request carrying skill or posting data | #5 | integration (network interception) | not started | — |
| 3 | Quality-gate wiring | Lock the floor: run typecheck + unit/integration in CI on every PR | cross-cutting | gates | not started | — |

**Status vocabulary** (fixed — parser literals): `not started` →
`change opened` → `researched` → `planned` → `implementing` → `complete`.

**Deferred phases (await S-02).** Two further phases are intentionally
*not* listed as active rows above because their code does not exist yet —
the `generate-tailored-skills-section` (S-02) slice is `proposed`, and you
cannot test a matching engine that has not been built:

- **Matching-engine correctness** — covers Risks #1, #2, #3 (synonym
  regression set + normalization equivalence classes + invented-skills
  invariant). This is the highest-value phase; it carries the core product
  hypothesis.
- **Output & clipboard CV-readiness** — covers Risk #7 (golden CV-format
  assertion + clipboard payload + unmatched-terms list correctness per
  FR-007).

Add these via `/10x-test-plan --refresh` once S-02 ships — that is exactly
the §8 trigger "a new top-3 risk surfaces from the roadmap." Until then the
orchestrator should only present Phases 1–3.

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | Vitest | 4.1.x | configured (`vitest.config.ts`); jsdom environment; 4 test files today (sparse) on the S-01 slice |
| component / DOM | `@testing-library/react` + `@testing-library/user-event` + jsdom | 16.3.x / 14.6.x / 29.1.x | for React islands (`BaseSkillsManager`, hooks) |
| storage round-trip | jsdom `localStorage` (no extra dep) | n/a | exercise the real serialization, do not mock it (see §2 #4) |
| network interception | Vitest `vi.spyOn(globalThis,'fetch')` / mock (no extra dep) | n/a | for the data-locality guard (§2 #5) |
| coverage | `@vitest/coverage-v8` | 4.1.x | `npm run test:coverage` |
| e2e | none — not warranted in v1 | — | one-page, deterministic, on-device tool; reachable via component/integration tests. Revisit if a DOM-unreachable surface appears |
| AI-native | none in v1 | — | when NOT to use: a deterministic rule-based matcher needs no LLM-as-judge; revisit only if v2 introduces LLM matching |

**Stack grounding tools (current session):**
- Docs: none — Context7 / framework docs MCP not available in current session; stack facts taken from local `package.json`, `vitest.config.ts`, `AGENTS.md`, `CLAUDE.md`; checked: 2026-06-02
- Search: none — Exa.ai / web search MCP not available in current session; checked: 2026-06-02
- Runtime/browser: Playwright MCP available, but not used — e2e/browser layer is not justified for a one-page on-device tool under cost × signal; checked: 2026-06-02
- Provider/platform: none — no GitHub/Cloudflare/Supabase MCP available in current session; Supabase is scaffolded-but-removed per F-01; checked: 2026-06-02

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase 3" means the gate is enforced once that rollout
phase lands; before that it is `planned`.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint | local + CI | required (wired today) | syntactic / style drift |
| typecheck (`astro check`) | local + CI | required after §3 Phase 3 | type drift (verify vs. build-time check) |
| unit + integration (`vitest run`) | local + CI | required after §3 Phase 3 | logic, persistence, locality regressions |
| post-edit hook | local (agent loop) | recommended (config deferred to M3 L3) | regressions at edit time |
| e2e on critical flows | CI on PR | not planned for v1 | n/a — no e2e layer (see §4) |
| visual / multimodal review | CI on PR | not planned for v1 | n/a — single page, no critical visual screen |
| pre-prod smoke | between merge + prod | optional | environment-specific Cloudflare failures |

CI today runs lint + build on push/PR to `main`. Phase 3 wires the test and
typecheck gates; CI YAML configuration itself is owned by Module 1 Lesson 5
/ Module 2 Lesson 5, not by this plan.

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once the
relevant rollout phase ships; before that it reads "TBD — see §3 Phase N."

### 6.1 Adding a unit test

- **Scope**: pure functions in `src/lib/services/` (no DOM, no storage) —
  e.g. `validateSkillName` / `isDuplicate` in `skills.ts`. Worked example:
  `src/lib/services/skills.test.ts`.
- **Pattern**: import the function and assert the **rule**, not the
  implementation's intermediate output. For dedup, assert that `"Git"` and
  `" git "` collide (case- and whitespace-insensitive); do **not** snapshot
  `normalize()` / `dedupKey()` output — that mirrors the code (see §2 #2).
- **Edge cases are mandatory** (§2 #6 anti-pattern): every rule carries at
  least one rejecting case — empty/whitespace, max-length boundary,
  disallowed chars — not just a happy accept. Use `it.each` for equivalence
  classes so each case catches a distinct regression.

### 6.2 Adding an integration / persistence test

- **Scope**: `useBaseSkills` (state + `localStorage` + CRUD). Worked example:
  `src/components/hooks/useBaseSkills.test.ts`.
- **Pattern**: drive the hook with `renderHook` + `act` from
  `@testing-library/react`; use the **real jsdom `localStorage`** — never mock
  the storage layer, that hides the serialization bug #4 is about (see §2 #4).
  Clear the store in `beforeEach`.
- **Cross-session round-trip** (the headline FR-004 proof): mutate via the
  hook → `unmount()` → fresh `renderHook(() => useBaseSkills())` → assert
  `result.current.skills` equals the **literal expected list** you constructed,
  NOT a value re-read via `readStore` (the oracle/mirror trap). Cover
  add/edit/delete survival.
- **Degrade-safely**: seed `localStorage` raw with corrupt or unknown-version
  bytes, mount, assert `[]` and no throw. Per the 2026-06-04 decision,
  unknown/future versions are *intentionally* discarded (start-fresh) — assert
  the clean `{version:1}` envelope after the next add, not `readStore` output.
- **Storage failure**: `vi.spyOn(Storage.prototype, "setItem")` to throw;
  assert CRUD still updates memory and does not crash (NFR robustness).

### 6.3 Adding an on-device data-locality test

- TBD — see §3 Phase 2 (assert CRUD performs zero network requests carrying
  skill or posting data).

### 6.4 Adding a matching-engine test

- TBD — deferred phase (awaits S-02): synonym regression set, normalization
  equivalence classes, and the output ⊆ declared-skills invariant.

### 6.5 Adding an output / clipboard test

- TBD — deferred phase (awaits S-02): golden CV-ready format + clipboard
  payload + unmatched-terms list correctness.

### 6.6 Per-rollout-phase notes

(Optional. After each phase lands, `/10x-implement` appends a 2–3 line note
here capturing anything surprising the phase taught.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout. Future contributors should respect
these unless the underlying assumption changes.

- **shadcn/ui primitives** (`button`, `input`, and other `src/components/ui/`
  components) — upstream-owned, low blast radius for a solo tool.
  Re-evaluate if a primitive is forked and given custom logic. (Source:
  Phase 2 interview Q5.)
- **The removed Supabase auth scaffold** — dead weight neutralized by F-01,
  not a live surface. Note: its *removal* is instead guarded positively by
  Risk #5 (no network call carries user data).
- **XSS / sanitization of pasted posting text** — single-user, on-device
  tool; React escapes rendered text by default; the only blast radius is the
  user's own browser. Re-evaluate if the app ever renders another user's
  content or adds `dangerouslySetInnerHTML`.
- **Astro SSR / Cloudflare Workers plumbing** — framework and adapter
  responsibility, not application logic.
- **Visual / DOM snapshots of the page** — brittle, low signal for a
  one-page tool; behavior is covered by component-interaction tests instead.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-02
- Stack versions last verified: 2026-06-02
- AI-native tool references last verified: 2026-06-02

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive — in particular when
  **S-02 (`generate-tailored-skills-section`) ships**, add the two deferred
  phases (matching-engine correctness, output/clipboard CV-readiness),
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
