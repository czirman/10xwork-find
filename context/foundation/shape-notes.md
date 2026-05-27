---
project: 10xwork-find
context_type: greenfield
updated: 2026-05-24
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  frs_drafted: 8
  quality_check_status: accepted
product_type: web-app
target_scale:
  users: small
timeline_budget:
  mvp_weeks: 3
  after_hours_only: true
  hard_deadline: null
---

## Vision & Problem Statement

A Java developer targeting a small set of dream companies needs the skills section of their CV to use the exact language of each job posting — but their base skills are stored in their own terms (e.g., "Git", "Docker"). Manually rewriting that section for each application is tedious, error-prone, and risks missing a semantic match ("knowledge of VCS" ≠ "Git" to a naive reader). The product automates that mapping: paste a job posting's skill requirements, get back a generated skills section drawn from your real experience, expressed in the posting's language.

## User & Persona

**Primary persona:** A single named user — the builder themselves. A Java developer mid-job-search with a short list of target companies. Not a mass-applier; each application is intentional and high-stakes.

- One user only. No multi-tenancy.
- Goal per session: produce a tailored skills section for one specific application.
- Success signal: lands an interview at a target company.

**Persona scope decision:** Personal tool only — built for this job search. Not intended for other users in v1.

## Functional Requirements

### Base Skills Management
- FR-001: User can add a base skill to their personal skills list. Priority: must-have
  > Socrates: Counter-argument considered: "Seed from a pre-built Java template or use config file only." Resolution: kept as written. Free-form add via UI preserves flexibility and avoids forcing the developer-only edit flow on a personal tool.
- FR-002: User can edit an existing base skill in their skills list. Priority: must-have
  > Socrates: Counter-argument considered: "Delete + re-add is sufficient." Resolution: kept. A dedicated edit is table stakes; delete+re-add creates unnecessary friction.
- FR-003: User can delete a base skill from their skills list. Priority: must-have
  > Socrates: Counter-argument considered: "Soft-delete (disable) is safer." Resolution: kept as hard delete for v1 simplicity. Soft-delete is a v2 consideration.
- FR-004: Base skills list persists between sessions (local storage). Priority: must-have
  > Socrates: Counter-argument considered: "A config file IS the persistence." Resolution: kept — persistence must be guaranteed regardless of storage mechanism chosen downstream.

### Job Posting Matching
- FR-005: User can paste raw skill requirements from a job posting as free text. Priority: must-have
  > Socrates: Counter-argument considered: "Structured input would be easier to parse." Resolution: kept as free text. Friction-free copy-paste is the stated UX; the matching engine must handle real-world posting language.
- FR-006: App matches posting skill terms to base skills using a curated synonym map (stored as a config file, edited by the developer). Priority: must-have
  > Socrates: Counter-argument considered: "Synonym map will be too incomplete; LLM needed from day one." Resolution: accepted risk. The 75% success criterion will be the empirical test. If v1 misses too often, LLM is the v2 upgrade path (already planned).
- FR-007: App shows posting terms that had NO match in the base skills list (unmatched terms), so the user can see gaps and improve the synonym map. Priority: must-have
  > Socrates: Counter-argument considered: "Show only unmatched terms — matched ones are obvious." Resolution: revised. Output shows matched skills section + a separate list of unmatched posting terms. Full per-match breakdown deferred to v2.

### Output
- FR-008: User can copy the generated skills section to clipboard in CV-ready format. Priority: must-have
  > Socrates: Counter-argument considered: "Download as .txt/.docx more useful." Resolution: clipboard for v1; download as nice-to-have in v2. Counter-argument noted but not blocking.

## Forward: tech-stack
- Java developer is the builder; Java/JVM or a lightweight JS/TS stack are both plausible. No preference captured — deferred to stack selection.
- "Data stays local" guardrail + rule-based v1 = no backend server strictly required. A pure frontend (SPA with localStorage) is viable.

## Business Logic

The app classifies each posting skill term as **matched** (maps to a base skill via synonym map) or **unmatched** (no mapping found), then assembles the matched base skills into a CV-ready skills section. The synonym map is the sole mechanism for classification; no inference, no probabilistic scoring in v1.

Inputs: (1) the user's base skills list, (2) the posted skill requirements as free text, (3) the curated synonym map config file.
Output: (1) a formatted skills section listing matched base skills, (2) a separate list of unmatched posting terms.

The user encounters the result immediately after submitting the posting text — no asynchronous wait in v1.

## Non-Goals

- **No LLM / AI matching in v1.** Rule-based synonym map only. LLM upgrade is the planned v2 path if the 75% match rate is not reached.
- **No other CV sections.** Only the skills section is generated. Education, work experience, summary, cover letter — all out of scope.
- **No PDF import or job posting scraping.** Input is manual paste only. No file upload, no URL-based scraping.
- **No auth, no multi-user, no mobile app.** Single user, no login, web browser only.

## Non-Functional Requirements

- **Response time:** the generated output appears within 1 second of the user submitting the posting text, as perceived by the user. Rule-based classification is the mechanism — no network round-trip needed.

## User Stories

### US-01: Primary flow — generate tailored skills section
**Given** I have my base skills saved in the app,
**When** I paste raw skill requirements from a job posting,
**Then** the app maps each posting term to my matching base skills using the synonym map, shows me the match reasoning, and produces a formatted skills section I can copy directly into my CV.

## Success Criteria

### Primary
Given a real job posting pasted as free text, the generated skills section correctly maps ≥ 75% of relevant posting skill requirements to the user's declared base skills. Matching uses a curated synonym map.

MVP flow (step-by-step):
1. User opens app — base skills list is visible
2. User adds/edits base skills (e.g., "Git", "Java 17", "Docker")
3. User pastes raw skill requirements from a job posting (free text, copy-paste)
4. App applies synonym map: posting terms → matching base skills
5. App outputs a tailored skills section ready to paste into the CV

### Secondary
The output is copy-paste ready — formatted exactly as a CV skills section with no cleanup needed before pasting into the CV document.

### Guardrails
- **No invented skills:** the output must only contain skills the user explicitly declared in their base list. No hallucination, no inferred additions.
- **Transparent matching:** the user can see which base skill mapped to which posting term and why. No black-box output.
- **Data stays local:** base skills and pasted job posting content are never sent to a third-party server. Rule-based matching keeps all computation local.

> Scope decision: LLM-powered matching deferred to v2. v1 uses a hand-curated synonym map. Reason: scoped down from a 4–6 week estimate to stay within ~3 weeks of after-hours work.

## Access Control

N/A — single user, no login, no account separation. The user opens the app and is immediately in. No auth system in scope.

## Quality cross-check

All six greenfield elements present. Status: accepted. No gaps recorded.
- Access Control: present (N/A single user)
- Business Logic: present (one-sentence classification rule)
- Project artifacts: present
- Timeline-cost ack: present (mvp_weeks ≤ 3; scope-down from 4–6 weeks recorded)
- Non-Goals: present (4 entries)
- Preserved behavior: n/a (greenfield)

