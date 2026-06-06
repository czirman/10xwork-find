---
project: 10xwork-find
version: 1
status: draft
created: 2026-05-30
updated: 2026-06-06
prd_version: 1
main_goal: market-feedback
top_blocker: none
---

# Roadmap: 10xwork-find

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

A Java developer mid-job-search needs the skills section of their CV to speak the exact language of each target posting, while their real skills are stored in their own terms ("Git", "Docker"). The product closes that translation gap: paste a posting's raw skill requirements, get back a CV-ready skills section drawn only from the user's declared skills, expressed in the posting's vocabulary, matched by a hand-curated synonym map.

The riskiest assumption — the single belief that, if false, sinks v1 — is that a hand-curated synonym map (no LLM, no scoring) can correctly map ≥ 75% of a real posting's skill terms. The whole v1 exists to test that empirically; an LLM upgrade is the planned v2 fallback if the rule-based map misses too often.

## North star

**S-02: User pastes a posting and gets a copyable, CV-ready skills section.** — This is the validation milestone: the only slice that exercises the synonym map against real posting text and so proves (or disproves) the ≥ 75% hypothesis the whole product rests on.

> "North star" here means the smallest end-to-end slice whose successful delivery would prove the core product hypothesis — placed as early as its Prerequisites allow, because everything else only matters if this works. S-02 sits behind a minimal base-skills slice (S-01) and the no-auth shell (F-01) because matching has nothing to map without a saved skills list and a reachable page.

## At a glance

| ID   | Change ID                        | Outcome (user can …)                                                        | Prerequisites | PRD refs                              | Status   |
| ---- | -------------------------------- | --------------------------------------------------------------------------- | ------------- | ------------------------------------- | -------- |
| F-01 | local-only-app-shell             | (foundation) lands directly in the tool — no login wall, data stays on-device | —             | Access Control, NFR (data-stays-local) | done     |
| S-01 | manage-base-skills               | add, edit, and delete base skills, persisted across sessions on-device      | F-01          | FR-001, FR-002, FR-003, FR-004        | done     |
| S-02 | generate-tailored-skills-section | paste a posting → get a copyable tailored skills section + unmatched terms  | S-01          | US-01, FR-005, FR-006, FR-007, FR-008 | proposed |

## Baseline

What's already in place in the codebase as of `2026-05-30` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 islands + Tailwind 4 + shadcn/ui (`src/layouts/Layout.astro`, `src/pages/index.astro` shows the starter Welcome, `src/components/ui/button.tsx`). No app-specific UI yet.
- **Backend / API:** partial — Astro SSR routes exist but only for auth (`src/pages/api/auth/{signin,signup,signout}.ts`). No domain API; per PRD + tech-stack, none is needed (rule-based, local).
- **Data:** absent — PRD requires on-device-only data. Supabase is scaffolded (`@supabase/ssr`, `src/lib/supabase.ts`) but `tech-stack.md` declares it "left unused, deliberate". No browser-local persistence layer; `supabase/` holds only `config.toml`, no migrations.
- **Auth:** present-but-unwanted — full Supabase auth scaffold (`src/middleware.ts`, auth forms under `src/components/auth/`, 3 API routes). PRD: "no auth in scope" → dead weight to neutralize, not to build on.
- **Deploy / infra:** present — Cloudflare Workers, live at `https://10xwork-find.service-mak.workers.dev`, CI auto-deploys on push to `main` (per `context/deployment/deploy-plan.md`, deployed 2026-05-28).
- **Observability:** absent — no Sentry/Datadog/OTel; `wrangler tail` for logs only. PRD implies none needed for a single-user local tool.

## Foundations

### F-01: Local-only app shell (no auth gate)

- **Outcome:** (foundation) the single user opens the app and is immediately in the tool — the Supabase auth gate (middleware redirect, signin/signup flow) is neutralized and the landing page is the tool, not the starter Welcome.
- **Change ID:** local-only-app-shell
- **PRD refs:** Access Control ("single user; no auth; data lives on-device only"), NFR ("no base skill data or job posting content leaves the user's device")
- **Unlocks:** S-01 (needs an unguarded page to host skills management), S-02 (needs the tool reachable without login). Also reduces the Baseline contradiction: removes the present-but-unwanted auth layer that would otherwise redirect the user.
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced first because every user-facing slice assumes an unguarded landing page. The risk is scope creep into a full "app shell rebuild" — keep this to bypassing/removing the auth gate and pointing the landing at the tool. Leaving dead middleware/Supabase redirects in place would silently re-gate the app; neutralize, don't half-remove.
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
- **Risk:** Sequenced before S-02 because the matching engine has nothing to map without a saved base-skills list. The risk is over-engineering persistence — the PRD's "data stays local" + single-user scope means browser-local storage is sufficient; do not reach for the scaffolded Supabase layer.
- **Status:** done

### S-02: Generate tailored skills section from a posting

- **Outcome:** User can paste a job posting's raw skill requirements and get back a CV-ready skills section (built only from their matched base skills) plus a separate list of unmatched posting terms, copyable to clipboard.
- **Change ID:** generate-tailored-skills-section
- **PRD refs:** US-01, FR-005, FR-006, FR-007, FR-008; NFR (output within ~1s of submission); NFR (data stays on-device)
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** — (output scope resolved 2026-05-30: v1 shows only the matched skills section + unmatched-terms list, per FR-007; per-term breakdown and any in-app flagging deferred to v2 — see ## Parked)
- **Risk:** This is the validation milestone and carries the core hypothesis: the hand-curated synonym map may map < 75% of real posting terms (FR-006 accepts this risk; the 75% Success Criterion is the empirical test, LLM is the v2 fallback). Sequenced last because it consumes S-01's data and the F-01 shell. Acceptance criteria are now fixed (unmatched-terms list only), so the slice is plannable once S-01 lands.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                        | Suggested issue title                                            | Ready for `/10x-plan` | Notes                                                        |
| ---------- | -------------------------------- | ---------------------------------------------------------------- | --------------------- | ----------------------------------------------------------- |
| F-01       | local-only-app-shell             | Land the single user directly in the tool — neutralize auth gate | done                  | Implemented + impl-reviewed. Run `/10x-archive local-only-app-shell` to formally close it out. |
| S-01       | manage-base-skills               | Manage base skills list (add/edit/delete, persist on-device)     | no                    | Prereq F-01 not yet done.                                   |
| S-02       | generate-tailored-skills-section | Generate tailored CV skills section from a pasted posting        | no                    | Prereq S-01 not yet done; output scope now fixed (unmatched-terms list only). |

## Open Roadmap Questions

None open. All resolved 2026-05-30:

1. **Scale assumptions (`target_scale.qps` / `target_scale.data_volume`)** — RESOLVED: confirmed `low` / `small` (single-user, on-device tool). No roadmap impact.
2. **Per-term match explanation vs. unmatched-terms list only?** — RESOLVED: v1 shows only the matched skills section + a separate unmatched-terms list (FR-007 option a). The full per-term breakdown is deferred to v2 (see ## Parked). This unblocks the north star **S-02** (`blocked` → `proposed`).
3. **In-app path to flag/request synonym-map improvements?** — RESOLVED: the unmatched-terms list is purely informational; the synonym map is maintained by the developer outside the app. No in-app flagging in v1 (see ## Parked).

## Parked

- **LLM / AI-powered matching** — Why parked: PRD §Non-Goals. Rule-based synonym map only in v1; LLM is the planned v2 upgrade path if the ≥ 75% match rate is not reached.
- **Other CV sections (education, work experience, summary, cover letter)** — Why parked: PRD §Non-Goals. Only the skills section is generated.
- **PDF import / job-posting scraping (file upload, URL scraping)** — Why parked: PRD §Non-Goals. Input is manual paste only.
- **Auth, multi-user, mobile app** — Why parked: PRD §Non-Goals. Single user, no login, web browser only. (F-01 actively neutralizes the scaffolded auth.)
- **Download output as .txt/.docx** — Why parked: FR-008 Socratic resolution. Clipboard only in v1; download is a v2 nice-to-have.
- **Soft-delete (disable) of base skills** — Why parked: FR-003 Socratic resolution. Hard delete only in v1.
- **Full per-match breakdown in output** — Why parked: FR-007 Socratic resolution. Deferred to v2 (Open Roadmap Q2 resolved 2026-05-30 toward option (a): unmatched-terms list only in v1).
- **In-app synonym-map flagging / improvement requests** — Why parked: Open Roadmap Q3 resolved 2026-05-30. The unmatched-terms list is informational only; the map is curated by the developer outside the app. A v2 candidate if user-driven map growth proves valuable.

## Done

- **S-01: User can add, edit, and delete base skills in a personal list that persists between sessions, stored on-device.** — Archived 2026-06-06 → `context/archive/2026-05-31-manage-base-skills/`. Lesson: —.
- **F-01: (foundation) the single user opens the app and is immediately in the tool — the Supabase auth gate (middleware redirect, signin/signup flow) is neutralized and the landing page is the tool, not the starter Welcome.** — Archived 2026-06-06 → `context/archive/2026-05-30-local-only-app-shell/`. Lesson: —.
