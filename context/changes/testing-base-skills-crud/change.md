---
change_id: testing-base-skills-crud
title: Tests for base-skills persistence & CRUD integrity (rollout Phase 1, Risks #4 & #6)
status: implementing
created: 2026-06-04
updated: 2026-06-04
archived_at: null
---

## Notes

Rollout Phase 1 of `context/foundation/test-plan.md`. Adds the risk-based tests
that protect the shipped S-01 (`manage-base-skills`) slice:

- **Risk #4** — base-skills list survives reloads; absent / corrupt / unknown-version
  stored data degrades safely (no crash). Oracle: FR-004 + the documented decision
  (2026-06-04) that an unknown schema version → **discard-and-start-fresh is intended**
  (corroborated by the `SkillsStore` contract comment in `src/types.ts`).
- **Risk #6** — CRUD integrity: add rejects empty/whitespace + duplicates; edit and
  delete target only the intended item.

Test types: unit + integration (real jsdom `localStorage` round-trip). Test runner
(Vitest + jsdom) already configured — no new infra. `/10x-new` was skipped; this
folder was created by `/10x-research`.
