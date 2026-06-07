---
change_id: test-plan-refresh-2026-06-06
title: Test plan refresh 2026 06 06
status: archived
created: 2026-06-06
updated: 2026-06-07
archived_at: 2026-06-07T07:51:03Z
---

## Notes

Resolved intent (2026-06-06): **Both** —

1. Refresh `context/foundation/test-plan.md` now that S-02
   (`generate-tailored-skills-section`) has shipped (matching.ts, synonym-map.ts,
   PostingMatcher.tsx exist). The §8 refresh trigger "when S-02 ships" is met:
   add the two deferred phases (matching-engine correctness, output/clipboard
   CV-readiness) and reclassify S-02 risks (#1,#2,#3,#7) from "proposed / not in
   tree" to live.
2. Wire the Lesson 3 (M3 L3) hooks the test plan defers in §5: fix the broken
   `.claude/settings.json` PostToolUse hook (correct `.tool_input.file_path`, use
   `astro check`, keep per-edit fast, add scoped `vitest related` on risk files)
   and the pre-commit gate (existing `.husky/pre-commit` + lint-staged).
