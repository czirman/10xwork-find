---
change_id: manage-base-skills
title: Manage base skills list (add/edit/delete, persist on-device)
status: impl_reviewed
created: 2026-05-31
updated: 2026-05-31
archived_at: null
---

## Notes

Roadmap S-01 (FR-001–FR-004). Add, edit, and delete base skills in a personal
list that persists between sessions, stored on-device in the browser. A single
React island mounted at the existing `#app-root` placeholder, backed by a
localStorage persistence hook and pure validation/dedup functions. Prerequisite
F-01 (local-only-app-shell) is done. Unlocks the north star S-02
(generate-tailored-skills-section), which consumes this saved skills list as the
join key against the synonym map.
