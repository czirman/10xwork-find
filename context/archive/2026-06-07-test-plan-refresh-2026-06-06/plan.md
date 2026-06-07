# Test Plan Refresh + Lesson 3 Hook Wiring Implementation Plan

## Overview

Two coupled pieces of work in one change:

1. **Wire the Lesson 3 (M3 L3) local quality hooks** the test plan defers in
   §5 — fix the broken per-edit `PostToolUse` hook in `.claude/settings.json`
   and strengthen the `.husky/pre-commit` gate.
2. **Refresh `context/foundation/test-plan.md`** now that S-02
   (`generate-tailored-skills-section`) has shipped — reclassify its risks as
   live, add the two deferred rollout phases, and mark the post-edit-hook gate
   wired.

Hooks land first (Phases 1–2) so the doc's §5 "wired" status is true when the
refresh (Phase 3) is written.

## Current State Analysis

- **S-02 shipped.** `src/lib/services/matching.ts`, `synonym-map.ts`,
  `src/components/PostingMatcher.tsx` and their tests now exist (commits
  `c349b54`, `ac18e53`). The test plan still describes S-02 as "proposed … not
  yet in the tree" (§2 narrative, §3 deferred note) — stale. The §8 refresh
  trigger "when S-02 ships, add the two deferred phases" is therefore met.
- **Per-edit hook is broken** (`.claude/settings.json` `PostToolUse`):
  - reads `jq -r '.inputs.path // .inputs.filePath'` — Claude Code stdin is
    `.tool_input.file_path`, so the path is always empty and `eslint` runs on no
    file.
  - runs `npx tsc --noEmit` on every edit — the project typechecks with
    `astro check` (`@astrojs/check` installed), and a full typecheck per-edit
    violates the "keep per-edit fast" rule (CLAUDE.md Key rules).
  - runs no scoped tests; no failure→agent feedback wiring.
- **Commit gate is thin.** `.husky/pre-commit` is just `npx lint-staged`
  (eslint --fix on `*.{ts,tsx,astro}`, prettier on `*.{json,css,md}`). No
  typecheck, no tests on staged risk files.
- **Risk areas** (test-plan §1, used to gate scoped tests):
  `src/lib/services/`, `src/components/`, `src/components/hooks/`.
- **Tooling present:** `npm run lint` (`eslint .`), `npx astro check`,
  `vitest` (config includes `src/**/*.{test,spec}.{ts,tsx}`, jsdom). Husky v9 +
  lint-staged already configured in `package.json`.

## Desired End State

- `.claude/settings.json` per-edit hook reads the correct file path, runs
  `eslint --fix` + `prettier --write` on the edited file only, and on an
  unfixable failure exits 2 with a message that reaches the agent.
- `.husky/pre-commit` runs `lint-staged`, then `astro check`, then
  `vitest related` on staged risk-area files; any failure aborts the commit.
- `test-plan.md` reflects reality: S-02 risks live, two new front-of-queue
  phases in §3, §5 post-edit-hook row wired, §8 freshness dates current.

Verify: trigger each hook with a known-bad input and confirm it blocks; read
the refreshed doc and confirm no "proposed / not in tree" phrasing remains for
S-02 and the two phases appear in §3.

### Key Discoveries:

- Claude Code PostToolUse stdin path is `.tool_input.file_path` (CLAUDE.md
  Task Router; current hook uses the wrong key).
- `astro check` is the project typecheck, not `tsc` (test-plan §5).
- `src/components/` in the risk regex subsumes `src/components/hooks/`.
- Husky v9 hook scripts continue past a failing line unless `set -e` — needed
  so `astro check` / `vitest` failures actually abort the commit.

## What We're NOT Doing

- No pre-push layer (deferred — not all layers needed day one, CLAUDE.md).
- No migration off Husky to Lefthook (CLAUDE.md: "If Husky already works, don't
  migrate").
- No CI/CD YAML changes (owned by Module 1 L5 / Module 2 L5).
- No authoring of cookbook §6.4 / §6.5 — those tests don't exist yet; the doc's
  own convention keeps them "see §3 Phase N".
- No new test code, no risk-strategy or quality-gate _definition_ changes
  (Lesson 1 territory) — only the S-02 reclassification the §8 trigger mandates.
- No adding the two new S-02 phases as code (they open their own change folders
  later); this change only lists them in §3.

## Implementation Approach

Assign each check to the cheapest layer that still gives signal (CLAUDE.md):
fast lint/format at per-edit (the only layer that feeds the agent), heavier
typecheck + scoped tests at pre-commit. Then make the doc describe that
end state. Each phase is independently verifiable.

## Critical Implementation Details

- **Per-edit hook reads stdin once.** The hook command gets the tool payload on
  stdin; capture it once into a var, then `jq` the file path out — piping stdin
  into multiple `jq`/command stages will consume it. Guard empty/non-source
  paths with an early `exit 0` so non-code edits (e.g. this `plan.md`) don't
  invoke eslint.
- **Exit-code remap for agent feedback.** `eslint` exits 1 on lint errors;
  Claude Code treats **exit 2** as the blocking code that feeds output back to
  the agent. After `--fix`, if eslint still reports errors, the hook must emit
  the message and `exit 2` (not 1) for the agent to see and self-correct.
- **Feedback must reach the agent on stderr.** On exit 2, Claude Code feeds the
  hook's **stderr** to the model (stdout reaches context only via a JSON
  `additionalContext` payload on exit 0). `eslint` prints to stdout, so if
  manual check 1.6 shows the agent isn't seeing the message, capture eslint
  output and re-emit on stderr before exiting 2
  (`OUT=$(npx eslint "$FILE") || { echo "$OUT" >&2; exit 2; }`).
- **Pre-commit must `set -e`.** Husky v9 runs a plain shell script; without
  `set -e` a failing `astro check` won't abort the commit. The scoped-test step
  selects staged files under the risk regex and no-ops when none match.

## Phase 1: Fix the per-edit agent hook

### Overview

Replace the broken `PostToolUse` hook with a single fast lint+format command
that reads the correct file path and blocks with feedback on unfixable errors.

### Changes Required:

#### 1. PostToolUse hook

**File**: `.claude/settings.json`

**Intent**: Make the per-edit hook actually lint/format the file the agent just
wrote, and surface unfixable problems to the agent. Drop the per-edit typecheck
(moves to pre-commit, Phase 2).

**Contract**: One `PostToolUse` entry, matcher `Edit|Write`, with a single
`command` hook (replacing the current two-command array). The command:
captures stdin, extracts `FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path')`,
early-`exit 0` if `FILE` is empty or not `*.{ts,tsx,astro,js,jsx,json,css,md}`,
runs `eslint --fix "$FILE"` (for lint-eligible extensions) and
`prettier --write "$FILE"`, then re-runs `eslint "$FILE"` and `exit 2` with the
eslint output if it still fails. Keep `permissions` and other keys unchanged.

```jsonc
// shape of the single command (escaping omitted): read stdin once, gate, fix, re-check, exit 2 on failure
"command": "INPUT=$(cat); FILE=$(echo \"$INPUT\" | jq -r '.tool_input.file_path'); [ -z \"$FILE\" ] && exit 0; case \"$FILE\" in *.ts|*.tsx|*.astro|*.js|*.jsx) npx eslint --fix \"$FILE\"; npx prettier --write \"$FILE\"; npx eslint \"$FILE\" || exit 2;; *.json|*.css|*.md) npx prettier --write \"$FILE\";; esac"
```

### Success Criteria:

#### Automated Verification:

- `.claude/settings.json` is valid JSON: `jq . .claude/settings.json`
- No `tsc` reference remains in the hook: `! grep -q 'tsc' .claude/settings.json`
- Hook uses the correct stdin key: `grep -q 'tool_input.file_path' .claude/settings.json`
- Simulated bad input blocks: piping `{"tool_input":{"file_path":"<a file with an unfixable lint error>"}}` into the hook command exits 2

#### Manual Verification:

- In an agent session, edit a `src/` `.tsx` file with a fixable style issue — it
  is auto-fixed and the loop continues
- Introduce an unfixable lint error — the agent receives the eslint message and
  corrects it on the next turn
- Editing a non-source file (e.g. a markdown file) does not invoke eslint

**Implementation Note**: After automated verification passes, pause for manual
confirmation before Phase 2.

---

## Phase 2: Strengthen the pre-commit gate

### Overview

Catch what bypasses the agent (manual edits, teammate commits): typecheck the
project and run scoped tests on staged risk-area files, on top of the existing
lint-staged formatting.

### Changes Required:

#### 1. Pre-commit hook

**File**: `.husky/pre-commit`

**Intent**: Add a typecheck and scoped tests to the commit gate while keeping
the existing `lint-staged` step, so a failing typecheck or risk-file test
aborts the commit.

**Contract**: Script runs, in order: `set -e`; `npx lint-staged`;
`npx astro check`; then collect staged risk-area files and run `vitest related`
on them only when non-empty. Risk regex must cover the three §1 risk dirs
(`src/components/` subsumes `src/components/hooks/`).

```sh
set -e
npx lint-staged
npx astro check
FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '^src/(lib/services|components)/' || true)
if [ -n "$FILES" ]; then
  npx vitest related $FILES --run
fi
```

> Use the `if … fi` form, NOT `[ -n "$FILES" ] && …` as the final line: when no
> risk files are staged (the common case — including this plan's own doc commit,
> since `test-plan.md` is not under `src/`), a trailing `&&` test exits 1 and,
> as the script's last line, aborts the commit. The `if` block exits 0 when
> empty.

### Success Criteria:

#### Automated Verification:

- Hook contains the three steps: `grep -q 'astro check' .husky/pre-commit && grep -q 'vitest related' .husky/pre-commit && grep -q 'lint-staged' .husky/pre-commit`
- `set -e` present: `grep -q 'set -e' .husky/pre-commit`
- Running the hook with a deliberately broken staged risk file (failing test or
  type error) exits non-zero
- Running the hook with a clean staged risk file exits 0 and runs the related test

#### Manual Verification:

- `git commit` on a clean change succeeds and shows astro check + vitest output
- A commit staging a `src/lib/services/` file with a failing test is blocked
- A commit touching only non-risk files (e.g. a doc) skips the vitest step

**Implementation Note**: After automated verification passes, pause for manual
confirmation before Phase 3.

---

## Phase 3: Refresh test-plan.md

### Overview

Bring the test plan current with shipped S-02 and the now-wired hooks. Targeted
depth — no cookbook authoring for unwritten tests.

### Changes Required:

#### 1. Risk map narrative (§2)

**File**: `context/foundation/test-plan.md`

**Intent**: Reclassify the S-02-targeting risks as live now that the code
exists, so the plan stops calling them forward-looking.

**Contract**: Edit the paragraph after the §2 risk table (currently "Risks #1,
#2, #3 and #7 target the `generate-tailored-skills-section` (S-02) slice, which
is `proposed` in the roadmap and not yet in the tree…") to state S-02 has
shipped and these risks are now testable. Risk-table rows themselves
(impact/likelihood) are unchanged.

#### 2. Phased rollout (§3)

**File**: `context/foundation/test-plan.md`

**Intent**: Add the two deferred phases as active rows at the front of the queue
(matching-engine is the highest-value phase per the existing deferred note),
ahead of the data-locality guard and quality-gate wiring; renumber accordingly.

**Contract**: New §3 table order — (1) Base-skills persistence & CRUD
[complete, unchanged]; (2) Matching-engine correctness (Risks #1,#2,#3; unit +
characterization); (3) Output & clipboard CV-readiness (Risk #7; unit golden +
clipboard); (4) On-device data-locality guard (Risk #5; was #2); (5)
Quality-gate wiring (cross-cutting; was #3). Remove/trim the "Deferred phases
(await S-02)" block since those phases are now active rows. Update any "Phases
1–3" references to the new count.

#### 3. Quality-gates table (§5)

**File**: `context/foundation/test-plan.md`

**Intent**: Mark the post-edit hook gate wired and note the pre-commit
additions from Phases 1–2.

**Contract**: Change the §5 `post-edit hook` row from
"recommended (config deferred to M3 L3)" to wired (per-edit lint/format;
pre-commit adds typecheck + scoped tests). One-line note; do NOT add a §3
rollout phase for the hook work (per the chosen representation).

#### 4. Freshness ledger (§8)

**File**: `context/foundation/test-plan.md`

**Intent**: Record this refresh.

**Contract**: Bump the relevant "last reviewed/verified" dates in §8 to
2026-06-06 and the top-of-file "Last updated". Leave the refresh-trigger list
intact (the S-02 trigger is now consumed).

### Success Criteria:

#### Automated Verification:

- Both new phase names present: `grep -q 'Matching-engine correctness' context/foundation/test-plan.md && grep -q 'Output & clipboard CV-readiness' context/foundation/test-plan.md`
- Stale phrasing gone: `! grep -q 'not yet in the tree' context/foundation/test-plan.md`
- §5 hook gate no longer "deferred to M3 L3": `! grep -q 'config deferred to M3 L3' context/foundation/test-plan.md`
- Prettier passes on the doc: `npx prettier --check context/foundation/test-plan.md`

#### Manual Verification:

- Read §2/§3: S-02 risks read as live and the two phases sit front-of-queue in
  the correct order
- §5 hook row accurately describes the hooks shipped in Phases 1–2
- No internal contradictions (phase counts, cross-references) remain

**Implementation Note**: After automated verification passes, pause for manual
confirmation.

---

## Testing Strategy

### Unit Tests:

- None added — this change is config + documentation. Existing tests are the
  fixtures the hooks _run_, not new coverage.

### Integration Tests:

- The hooks themselves are the integration surface; verified by simulating
  hook stdin (Phase 1) and a staged-file commit (Phase 2).

### Manual Testing Steps:

1. Agent-edit a risk-area `.tsx`: confirm lint/format fires and bad lint blocks.
2. Stage a `src/lib/services/` file with a failing test, `git commit`: confirm
   abort with vitest output.
3. Commit a doc-only change: confirm vitest is skipped, astro check still runs.
4. Read the refreshed `test-plan.md` end-to-end for accuracy.

## Performance Considerations

- Per-edit stays sub-second (lint/format on one file only); the heavier
  `astro check` + `vitest related` run at commit, not per edit, per the
  cost×signal rule.

## Migration Notes

- No data migration. Hook config changes take effect on next agent edit /
  commit; no restart needed beyond Claude Code re-reading `.claude/settings.json`.

## References

- Change identity: `context/changes/test-plan-refresh-2026-06-06/change.md`
- Test plan being refreshed: `context/foundation/test-plan.md` (§2, §3, §5, §8)
- Hook guidance: `CLAUDE.md` (Task Router, Hook lifecycle, Key rules)
- Existing hook: `.claude/settings.json`; commit gate: `.husky/pre-commit`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fix the per-edit agent hook

#### Automated

- [x] 1.1 `.claude/settings.json` is valid JSON (`jq .`) — dec0d37
- [x] 1.2 No `tsc` reference remains in the hook — dec0d37
- [x] 1.3 Hook uses `tool_input.file_path` — dec0d37
- [x] 1.4 Simulated bad input exits 2 — dec0d37

#### Manual

- [x] 1.5 Fixable style issue auto-fixed in agent session — dec0d37
- [x] 1.6 Unfixable lint error reaches the agent and is corrected next turn — dec0d37
- [x] 1.7 Non-source file edit does not invoke eslint — dec0d37

### Phase 2: Strengthen the pre-commit gate

#### Automated

- [x] 2.1 Hook contains lint-staged + astro check + vitest related — 1a36f06
- [x] 2.2 `set -e` present — 1a36f06
- [x] 2.3 Broken staged risk file exits non-zero — 1a36f06
- [x] 2.4 Clean staged risk file exits 0 and runs the related test — 1a36f06

#### Manual

- [x] 2.5 Clean `git commit` succeeds with astro check + vitest output — 1a36f06
- [x] 2.6 Commit with failing service-file test is blocked — 1a36f06
- [x] 2.7 Doc-only commit skips vitest, runs astro check — 1a36f06

### Phase 3: Refresh test-plan.md

#### Automated

- [x] 3.1 Both new phase names present in the doc — 7020825
- [x] 3.2 "not yet in the tree" phrasing removed — 7020825
- [x] 3.3 "config deferred to M3 L3" removed from §5 — 7020825
- [x] 3.4 Prettier check passes on the doc — 7020825

#### Manual

- [x] 3.5 §2/§3 read as live with phases front-of-queue in correct order — 7020825
- [x] 3.6 §5 hook row matches shipped Phases 1–2 — 7020825
- [x] 3.7 No phase-count / cross-reference contradictions remain — 7020825
