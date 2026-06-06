<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Manage Base Skills

- **Plan**: context/changes/manage-base-skills/plan.md
- **Scope**: Phases 1–2 of 2
- **Date**: 2026-05-31
- **Verdict**: APPROVED
- **Findings**: 0 critical · 1 warning · 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — localStorage write is unguarded while the read is defensive

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/components/hooks/useBaseSkills.ts:57-60 (writeStore)
- **Detail**: readStore() is wrapped in try/catch and tolerates missing key / bad JSON / wrong version (the plan's "never throw" contract). The symmetric writeStore() calls localStorage.setItem with no guard. setItem can throw — QuotaExceededError, or a SecurityError in private-mode / storage-disabled browsers. Because the write runs inside the persist useEffect, a throw surfaces as an uncaught error rather than degrading gracefully. Low stakes for a single-user, small-data tool, but an asymmetry with the explicitly-defensive read.
- **Fix**: Wrap the setItem call in try/catch (mirroring readStore); on failure, no-op (optionally console.warn).
  - Strength: Mirrors the existing defensive-read pattern in the same file; removes the only unguarded boundary.
  - Tradeoff: A failed write is silently dropped (acceptable — alternative is crashing the effect).
  - Confidence: HIGH — one call site, trivial change.
  - Blind spot: None significant.
- **Decision**: FIXED — try/catch added to writeStore (useBaseSkills.ts:57-65)

### F2 — Per-row Edit/Delete buttons share identical accessible names

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency (Accessibility)
- **Location**: src/components/BaseSkillsManager.tsx:165-184
- **Detail**: Every row renders buttons labelled "Edytuj" / "Usuń" with no skill context. A screen-reader user navigating by buttons hears "Edytuj, Usuń, Edytuj, Usuń…" and can't tell which skill each acts on. Visible text is fine; only the accessible name is ambiguous.
- **Fix**: Add aria-label={`Edytuj ${skill.name}`} / `Usuń ${skill.name}` to the per-row buttons; update the component-test selectors (which query by visible role name) to a regex or the new names.
  - Strength: Standard a11y fix; no visual change.
  - Tradeoff: Requires touching the component test selectors.
  - Confidence: HIGH — well-understood ARIA pattern.
  - Blind spot: None significant.
- **Decision**: FIXED — per-skill aria-labels added; test selectors updated to regex (BaseSkillsManager.tsx + .test.tsx)
