---
change_id: persistence-write-diagnostic
title: Surface a diagnostic when localStorage persistence writes fail
status: new
created: 2026-06-07
updated: 2026-06-07
archived_at: null
---

## Notes

writeStore swallowed localStorage persistence failures silently with no diagnostic; added console.warn in the catch and a RED-first test in useBaseSkills
