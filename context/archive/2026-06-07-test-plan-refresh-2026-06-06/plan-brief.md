# Test Plan Refresh + Lesson 3 Hook Wiring — Plan Brief

> Full plan: `context/changes/test-plan-refresh-2026-06-06/plan.md`

## What & Why

S-02 (`generate-tailored-skills-section`) has shipped, which (a) makes the
`test-plan.md` content stale — it still calls the S-02 risks "proposed / not in
tree" — and (b) trips the §8 refresh trigger to add the two deferred test
phases. At the same time we're in M3 L3, and the test plan's §5 defers the
post-edit hook "config deferred to M3 L3" while the existing hook is actually
broken. This change does both: wire the Lesson 3 local hooks, then refresh the
doc to match.

## Starting Point

The per-edit `PostToolUse` hook reads the wrong stdin key (`.inputs.path`),
runs `tsc` instead of `astro check`, and typechecks on every edit; the commit
gate is just `npx lint-staged`. The `test-plan.md` describes S-02 as not yet
built and lists its two highest-value test phases as deferred.

## Desired End State

Per-edit lint/format that blocks with feedback to the agent; a pre-commit gate
that typechecks and runs scoped tests on staged risk files; and a `test-plan.md`
whose §2/§3/§5/§8 reflect shipped S-02 and the now-wired hooks.

## Key Decisions Made

| Decision                   | Choice                                             | Why                                                              | Source |
| -------------------------- | -------------------------------------------------- | --------------------------------------------------------------- | ------ |
| Change scope               | Both: refresh doc **and** wire hooks               | Empty change had no intent; user chose both                     | Plan   |
| Per-edit hook              | lint `--fix` + format only                         | CLAUDE.md: lint/format ideal per-edit, keep loop fast           | Plan   |
| Per-edit failure signal    | Block (exit 2) + feed context                      | The payoff of agent hooks — agent self-corrects                 | Plan   |
| Typecheck layer            | Pre-commit (`astro check`)                          | Full typecheck belongs at commit, not per-edit                  | Plan   |
| Commit tests               | Scoped `vitest related` on staged risk files       | Catch edits that bypass the agent; scoped = fast                | Plan   |
| Git hook tool              | Keep Husky (no Lefthook)                            | CLAUDE.md: don't migrate a working Husky setup                  | Plan   |
| Phase order in §3          | Two S-02 phases front-of-queue                     | §3 calls matching-engine the highest-value phase                | Plan   |
| Refresh depth              | Targeted (no cookbook 6.4/6.5 authoring)           | Doc convention: cookbook fills in once tests exist              | Plan   |
| Hook representation in doc | §5 gate update + note, no new §3 phase             | §3 rows are risk-driven test phases, not tooling                | Plan   |

## Scope

**In scope:** fix `.claude/settings.json` per-edit hook; add typecheck + scoped
tests to `.husky/pre-commit`; refresh `test-plan.md` §2/§3/§5/§8.

**Out of scope:** pre-push layer; Lefthook migration; CI YAML; cookbook
6.4/6.5 authoring; new test code; risk-strategy changes; building the two new
S-02 phases (they open their own change folders).

## Architecture / Approach

Cheapest-layer-per-check: fast lint/format at per-edit (only layer that feeds
the agent), heavier typecheck + scoped tests at pre-commit. Hooks land first so
the doc's §5 "wired" claim is accurate when the refresh is written last.

## Phases at a Glance

| Phase                         | What it delivers                                  | Key risk                                            |
| ----------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| 1. Fix per-edit hook          | Correct, fast, blocking lint/format hook          | stdin consumed twice / wrong exit code for feedback |
| 2. Strengthen pre-commit gate | astro check + scoped vitest on staged risk files  | missing `set -e` lets failures through              |
| 3. Refresh test-plan.md       | S-02 live, two phases front-of-queue, §5 wired    | internal contradictions (phase counts, refs)        |

**Prerequisites:** none — all tooling (eslint, astro check, vitest, husky)
already installed.
**Estimated effort:** ~1 session across 3 small phases (config + markdown).

## Open Risks & Assumptions

- Claude Code reads `.claude/settings.json` per session; the fixed per-edit hook
  may need a session reload to take effect.
- `vitest related` selection depends on import graph resolution; a risk file
  with no related test simply runs nothing (acceptable).

## Success Criteria (Summary)

- Agent gets actionable lint feedback at edit time and self-corrects.
- Commits with a broken typecheck or failing risk-file test are blocked locally.
- `test-plan.md` reads as current: S-02 risks live, two phases front-of-queue,
  post-edit hook gate marked wired.
