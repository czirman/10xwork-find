---
project: 10xwork-find
version: 2
status: active
created: 2026-05-30
updated: 2026-06-09
prd_version: 2
main_goal: market-feedback
top_blocker: none
---

# Roadmap: 10xwork-find

> Derived from `context/foundation/prd.md` (v2) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded. (v1 → `context/foundation/archive/2026-06-09-roadmap.md`.)
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

A Java developer mid-job-search needs the skills section of their CV to speak the exact language of each target posting, while their real skills are stored in their own terms ("Git", "Docker"). The product closes that translation gap: paste a posting's raw skill requirements, get back a CV-ready skills section drawn only from the user's declared skills, expressed in the posting's vocabulary, matched by a hand-curated synonym map.

The core hypothesis — the single belief that, if false, sinks v1 (the "core hypothesis" is the assumption the whole product is built to test) — is that a hand-curated synonym map (no LLM, no scoring) can correctly map ≥ 75% of a real posting's skill terms. That hypothesis is now shipped and live (S-02). What changed in v2: the tool is deployed at a **public** Cloudflare URL, so it needs a lightweight access gate — a single shared passphrase — so that only the owner can reach it. This is a privacy hardening of an already-working tool, not a new product bet.

## North star

**Already achieved — S-02 is shipped.** The north star (the smallest end-to-end slice whose successful delivery would prove the core product hypothesis, placed as early as Prerequisites allow because everything else only matters if it works) was **S-02: paste a posting → get a copyable tailored skills section**. It is implemented, reviewed, and archived. The single remaining slice (S-03, the access gate) is hardening, not a new validation milestone — there is no new north star to chase.

## At a glance

| ID   | Change ID                        | Outcome (user can …)                                                            | Prerequisites | PRD refs                               | Status |
| ---- | -------------------------------- | ------------------------------------------------------------------------------- | ------------- | -------------------------------------- | ------ |
| F-01 | local-only-app-shell             | (foundation) lands directly in the tool — no login wall, data stays on-device   | —             | Access Control, NFR (data-stays-local) | done   |
| S-01 | manage-base-skills               | add, edit, and delete base skills, persisted across sessions on-device          | F-01          | FR-001, FR-002, FR-003, FR-004         | done   |
| S-02 | generate-tailored-skills-section | paste a posting → get a copyable tailored skills section + unmatched terms      | S-01          | US-01, FR-005, FR-006, FR-007, FR-008  | done   |
| S-03 | passphrase-access-gate           | unlock the public app with a shared passphrase; visitors without it can't enter | F-01          | FR-009, Access Control                 | ready  |

## Baseline

What's already in place in the codebase as of `2026-06-09` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 islands + Tailwind 4 + shadcn/ui. The shipped tool is live: `src/pages/index.astro` hosts `src/components/SkillsTool.tsx` (composes S-01 base-skills management + S-02 posting matching).
- **Backend / API:** absent — no API routes (`src/pages/api/` does not exist). Per PRD the product is rule-based and on-device; no domain API is needed. The passphrase gate (S-03) is the first server/edge-side concern.
- **Data:** present (on-device) — base skills persist in browser-local storage per shipped S-01. No server-side data store; Supabase is gone from the codebase.
- **Auth:** absent — the previously-scaffolded Supabase auth module has been **removed** (no `src/middleware.ts`, no `src/components/auth/`, no auth API routes, no `@supabase/*` deps in `package.json`). Clean slate for the v2 passphrase gate; nothing to neutralize or restore.
- **Deploy / infra:** present — Cloudflare Workers, live at `https://10xwork-find.service-mak.workers.dev`, CI auto-deploys on push to `main`. The deployment is currently world-open (the gap S-03 closes).
- **Observability:** absent — no Sentry/Datadog/OTel; `wrangler tail` for logs only. PRD implies none needed for a single-user local tool.

## Foundations

(No _new_ foundations in v2. The v2 access gate is modelled as a vertical slice, S-03, not a foundation, because it has a user-visible outcome — the passphrase prompt — and traces to a must-have FR. F-01 below is the only foundation and is already `done`; its body block is retained per the `/10x-archive` convention.)

### F-01: Local-only app shell (no auth gate)

- **Outcome:** (foundation) the single user opens the app and is immediately in the tool — the Supabase auth gate (middleware redirect, signin/signup flow) is neutralized and the landing page is the tool, not the starter Welcome.
- **Change ID:** local-only-app-shell
- **PRD refs:** Access Control ("the user opens the app and is immediately in"), NFR ("no base skill data or job posting content leaves the user's device")
- **Unlocks:** S-01 (needs an unguarded page to host skills management), S-02 (needs the tool reachable), S-03 (the access gate wraps this shell).
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced first because every user-facing slice assumes a reachable landing page. Note S-03 now adds a passphrase wall in front of this shell — that tightens F-01's original "no login wall" posture, but does not contradict it: the v2 PRD Access Control explicitly puts an edge gate in scope while keeping the post-gate experience "immediately in the tool" and data on-device.
- **Status:** done

## Slices

### S-01: Manage base skills

- **Outcome:** User can add, edit, and delete base skills in a personal list that persists between sessions, stored on-device.
- **Change ID:** manage-base-skills
- **PRD refs:** FR-001, FR-002, FR-003, FR-004
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced before S-02 because the matching engine has nothing to map without a saved base-skills list. The risk was over-engineering persistence — "data stays local" + single-user scope means browser-local storage is sufficient; no Supabase reach.
- **Status:** done

### S-02: Generate tailored skills section from a posting

- **Outcome:** User can paste a job posting's raw skill requirements and get back a CV-ready skills section (built only from their matched base skills) plus a separate list of unmatched posting terms, copyable to clipboard.
- **Change ID:** generate-tailored-skills-section
- **PRD refs:** US-01, FR-005, FR-006, FR-007, FR-008; NFR (output within ~1s of submission); NFR (data stays on-device)
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** — (output scope resolved 2026-05-30: v1 shows the matched skills section + unmatched-terms list per FR-007; per-term breakdown deferred to v2 — see ## Parked)
- **Risk:** This was the validation milestone carrying the core hypothesis (the hand-curated synonym map may map < 75% of real posting terms; FR-006 accepts this risk, the 75% Success Criterion is the empirical test, LLM is the v2 fallback). Shipped and archived.
- **Status:** done

### S-03: Passphrase access gate

- **Outcome:** User can unlock the publicly-deployed app by entering the single shared passphrase; anyone reaching the URL without it is stopped at the gate and cannot use the tool.
- **Change ID:** passphrase-access-gate
- **PRD refs:** FR-009 (must-have), Access Control ("a lightweight authentication gate … a single shared passphrase checked at the edge, with no server-side user records")
- **Prerequisites:** F-01 (the unguarded app shell the gate now wraps — already `done`)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The app is **currently live publicly with no gate**, so the only thing protecting it is obscurity of the URL — this slice closes a real exposure on a shipped tool, which is why it is the sole remaining work. The chief design risk is scope creep back into account-based auth (the removed Supabase module); keep it to one edge-checked shared passphrase per FR-009 so the "data stays local" guarantee survives intact (no server-side user records). How/where the passphrase is configured (Worker secret vs env) is a `/10x-plan` implementation detail, not a roadmap blocker.
- **Status:** ready

## Backlog Handoff

| Roadmap ID | Change ID                        | Suggested issue title                                        | Ready for `/10x-plan` | Notes                                   |
| ---------- | -------------------------------- | ------------------------------------------------------------ | --------------------- | --------------------------------------- |
| F-01       | local-only-app-shell             | Land the single user directly in the tool — no login wall    | done                  | Shipped + archived 2026-06-06.          |
| S-01       | manage-base-skills               | Manage base skills list (add/edit/delete, persist on-device) | done                  | Shipped + archived 2026-06-06.          |
| S-02       | generate-tailored-skills-section | Generate tailored CV skills section from a pasted posting    | done                  | Shipped + archived 2026-06-06.          |
| S-03       | passphrase-access-gate           | Gate the public deploy behind a single shared passphrase     | yes                   | Run `/10x-plan passphrase-access-gate`. |

## Open Roadmap Questions

None open. (All v1 questions resolved 2026-05-30; the v2 access-gate scope is fixed by FR-009 — single edge-checked passphrase, no accounts.)

## Parked

- **LLM / AI-powered matching** — Why parked: PRD §Non-Goals. Rule-based synonym map only in v1; LLM is the planned v2 upgrade path if the ≥ 75% match rate is not reached.
- **Other CV sections (education, work experience, summary, cover letter)** — Why parked: PRD §Non-Goals. Only the skills section is generated.
- **PDF import / job-posting scraping (file upload, URL scraping)** — Why parked: PRD §Non-Goals. Input is manual paste only.
- **Multi-user / per-user accounts / account-based auth** — Why parked: PRD §Non-Goals + FR-009 Socratic resolution. The single-passphrase gate (S-03) is in scope; per-user identity (e.g. restoring the removed Supabase module) stays out — a v2 path only if the tool ever becomes multi-user.
- **Mobile app** — Why parked: PRD §Non-Goals. Web browser only.
- **Download output as .txt/.docx** — Why parked: FR-008 Socratic resolution. Clipboard only in v1; download is a v2 nice-to-have.
- **Soft-delete (disable) of base skills** — Why parked: FR-003 Socratic resolution. Hard delete only in v1.
- **Full per-match breakdown in output** — Why parked: FR-007 Socratic resolution. Deferred to v2; v1 shows the matched section + unmatched-terms list only.
- **In-app synonym-map flagging / improvement requests** — Why parked: Open Roadmap Q3 resolved 2026-05-30. The unmatched-terms list is informational only; the map is curated by the developer outside the app.

## Done

- **S-01: User can add, edit, and delete base skills in a personal list that persists between sessions, stored on-device.** — Archived 2026-06-06 → `context/archive/2026-05-31-manage-base-skills/`. Lesson: —.
- **F-01: (foundation) the single user opens the app and is immediately in the tool — the Supabase auth gate is neutralized and the landing page is the tool, not the starter Welcome.** — Archived 2026-06-06 → `context/archive/2026-05-30-local-only-app-shell/`. Lesson: —.
- **S-02: User can paste a job posting's raw skill requirements and get back a CV-ready skills section (built only from their matched base skills) plus a separate list of unmatched posting terms, copyable to clipboard.** — Archived 2026-06-06 → `context/archive/2026-06-06-generate-tailored-skills-section/`. Lesson: —.
