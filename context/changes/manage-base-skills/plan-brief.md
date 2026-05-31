# Manage Base Skills — Plan Brief

> Full plan: `context/changes/manage-base-skills/plan.md`

## What & Why

Give the single user a place to add, edit, and delete their **base skills** in a
list that persists on-device across sessions. This is roadmap **S-01**
(FR-001–FR-004) and the data foundation for the north star **S-02**: the matching
engine has nothing to map without a saved skills list, and each skill's `name` is
the exact join key S-02 matches against the synonym map.

## Starting Point

F-01 (local-only-app-shell) is merged. `src/pages/index.astro` already has the
header + an empty `<section id="app-root">` marked "S-01 mounts here." There is no
persistence layer, no `src/types.ts`, and no hooks dir yet. React islands,
shadcn/ui (new-york + lucide), and the Vitest + jsdom + testing-library stack are
all wired. UI copy in this project is Polish.

## Desired End State

Opening `/` shows a working skills manager: an add field, the saved list,
per-row inline edit (Save/Cancel), and per-row delete with a brief undo. The list
survives page reload and browser restart via localStorage. Duplicate adds
(case-insensitive, trimmed) are refused with an inline Polish message.

## Key Decisions Made

| Decision             | Choice                                                            | Why (1 sentence)                                                        | Source |
| -------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- | ------ |
| Storage              | Browser `localStorage`, versioned `{version:1, skills:[]}` envelope | PRD "data stays local" + single-user; roadmap says don't reach for Supabase | Plan   |
| Data model           | `Skill = { id, name }`                                            | Edit/delete need stable identity; `name` is S-02's join key            | Plan   |
| Dedup                | Case-insensitive, trimmed                                        | Keeps the list (and S-02 output) clean of near-duplicate CV entries    | Plan   |
| Validation           | Trim + reject empty, max 80, **min 1**, permissive charset       | Must accept real skills "C", "CI/CD", "Node.js", ".NET", "C++"         | Plan   |
| Duplicate UX         | Inline Polish message, no row added                              | Clear feedback without surprise; keeps list clean                      | Plan   |
| Edit UX              | Inline edit in row (Save/Cancel)                                 | Fast, no modal — fits a lightweight single-user tool                   | Plan   |
| Delete UX            | Immediate hard delete + brief "Cofnij" undo                     | Frictionless pruning, recoverable from misclick, still a hard delete   | Plan   |
| Mount directive      | `client:only="react"`                                           | Storage-backed island must not read localStorage during SSR            | Plan   |
| Testing bar          | Logic unit tests + key component tests                           | Covers the risk-bearing logic + island happy paths without over-investing | Plan   |
| Validation library   | None (no zod)                                                    | zod is the API-route convention; this slice has no API route           | Plan   |

## Scope

**In scope:** add / edit / delete base skills; on-device persistence; dedup +
validation; inline edit; delete-with-undo; empty state; Polish copy.

**Out of scope:** the synonym map (developer-maintained, S-02); any matching /
posting / output logic (S-02); categories, tags, reorder/drag, import/export;
soft-delete; Supabase / any server persistence; zod.

## Architecture / Approach

A single React island, `BaseSkillsManager.tsx`, mounted at the existing
`#app-root` with `client:only="react"`. It is presentational and delegates all
state + persistence to a `useBaseSkills` hook, which wraps a single localStorage
key and enforces the rules from pure functions in `src/lib/services/skills.ts`.
`Skill` and the store envelope live in `src/types.ts`. No backend, no API route.

## Phases at a Glance

| Phase                          | What it delivers                                                    | Key risk                                                       |
| ------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1. Persistence & domain logic  | `Skill` type, validation/dedup functions, localStorage hook + tests | Over-strict validation rejecting real skills — pinned permissive |
| 2. Skills-management UI island | Add/list/inline-edit/delete-undo island mounted + component tests   | SSR/localStorage hydration mismatch — pinned `client:only`    |

**Prerequisites:** F-01 (done). **Estimated effort:** ~1–2 after-hours sessions
across 2 phases.

## Open Risks & Assumptions

- localStorage assumed available and not cleared by the user (acceptable for a
  single-user local tool); private-mode quirks not specially handled.
- Permissive charset trades tightest junk-filtering for never false-rejecting a
  real skill — deliberate, because `name` is S-02's join key.

## Success Criteria (Summary)

- User can add, edit, and delete base skills, and the list persists across page
  reload and browser restart.
- Real skills like "C" and "CI/CD" are accepted; blanks and case-insensitive
  duplicates are refused with a clear Polish message.
- `npm run build`, `npm run lint`, and `npm run test:run` all pass.
