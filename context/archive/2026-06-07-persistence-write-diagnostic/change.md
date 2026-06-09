---
change_id: persistence-write-diagnostic
title: Surface a diagnostic when localStorage persistence writes fail
status: archived
created: 2026-06-07
updated: 2026-06-07
archived_at: 2026-06-07T13:50:39Z
---

## Notes

writeStore swallowed localStorage persistence failures silently with no diagnostic; added console.warn in the catch and a RED-first test in useBaseSkills
