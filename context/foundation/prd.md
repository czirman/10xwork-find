---
project: 10xwork-find
version: 2
status: draft
created: 2026-05-24
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

A Java developer targeting a small set of dream companies needs the skills section of their CV to use the exact language of each job posting — but their base skills are stored in their own terms (e.g., "Git", "Docker"). Manually rewriting that section for each application is tedious, error-prone, and risks missing a semantic match ("knowledge of VCS" ≠ "Git" to a naive reader). The product automates that mapping: paste a job posting's skill requirements, get back a generated skills section drawn from your real experience, expressed in the posting's language.

The insight: every Java developer already knows their skills; the friction is not knowledge but translation. A curated synonym map — built from real posting vocabulary — can close the translation gap without requiring the developer to become a copywriter for each application.

## User & Persona

**Primary persona:** A single named user — the builder themselves. A Java developer mid-job-search with a short list of target companies. Not a mass-applier; each application is intentional and high-stakes.

- One user only. No multi-tenancy.
- Goal per session: produce a tailored skills section for one specific application.
- Success signal: lands an interview at a target company.

Persona scope: personal tool only — built for this job search, not intended for other users in v1.

## Success Criteria

### Primary

Given a real job posting pasted as free text, the generated skills section correctly maps ≥ 75% of relevant posting skill requirements to the user's declared base skills using a curated synonym map.

### Secondary

The output is copy-paste ready — formatted exactly as a CV skills section with no cleanup needed before pasting into the CV document.

### Guardrails

- **No invented skills:** the output must only contain skills the user explicitly declared in their base list. No inferred additions.
- **Transparent matching:** the user can see which base skill mapped to which posting term and why. No black-box output.
- **Data stays local:** no base skill data or job posting content leaves the user's device.

## User Stories

### US-01: Generate tailored skills section from a job posting

- **Given** I have my base skills saved in the app
- **When** I paste raw skill requirements from a job posting
- **Then** the app maps each posting term to my matching base skills using the synonym map, shows me the match result, and produces a formatted skills section I can copy directly into my CV

#### Acceptance Criteria

- Output contains only skills declared in the user's base skills list
- Posting terms with no synonym map match are surfaced in a separate list
- Generated output is copyable to clipboard in CV-ready format
- Output is visible within 1 second of submission

## Functional Requirements

### Base Skills Management

- FR-001: User can add a base skill to their personal skills list. Priority: must-have
  > Socrates: Counter-argument considered: "Seed from a pre-built Java template or use config file only." Resolution: kept as written. Free-form add via UI preserves flexibility and avoids forcing the developer-only edit flow on a personal tool.
- FR-002: User can edit an existing base skill in their skills list. Priority: must-have
  > Socrates: Counter-argument considered: "Delete + re-add is sufficient." Resolution: kept. A dedicated edit is table stakes; delete+re-add creates unnecessary friction.
- FR-003: User can delete a base skill from their skills list. Priority: must-have
  > Socrates: Counter-argument considered: "Soft-delete (disable) is safer." Resolution: kept as hard delete for v1 simplicity. Soft-delete is a v2 consideration.
- FR-004: Base skills list persists between sessions. Priority: must-have
  > Socrates: Counter-argument considered: "A config file IS the persistence." Resolution: kept — persistence must be guaranteed regardless of storage mechanism chosen downstream.

### Job Posting Matching

- FR-005: User can paste raw skill requirements from a job posting as free text. Priority: must-have
  > Socrates: Counter-argument considered: "Structured input would be easier to parse." Resolution: kept as free text. Friction-free copy-paste is the stated UX; the matching engine must handle real-world posting language.
- FR-006: App matches posting skill terms to base skills using a curated synonym map. Priority: must-have
  > Socrates: Counter-argument considered: "Synonym map will be too incomplete; LLM needed from day one." Resolution: accepted risk. The 75% success criterion will be the empirical test. If v1 misses too often, LLM is the v2 upgrade path (already planned).
- FR-007: App shows posting terms that had NO match in the base skills list (unmatched terms), so the user can see gaps and identify potential synonym map improvements. Priority: must-have
  > Socrates: Counter-argument considered: "Show only unmatched terms — matched ones are obvious." Resolution: revised. Output shows matched skills section + a separate list of unmatched posting terms. Full per-match breakdown deferred to v2.

### Output

- FR-008: User can copy the generated skills section to clipboard in CV-ready format. Priority: must-have
  > Socrates: Counter-argument considered: "Download as .txt/.docx more useful." Resolution: clipboard for v1; download as nice-to-have in v2.

### Access

- FR-009: Access to the publicly-deployed app requires a single shared passphrase; only someone holding the passphrase can reach the tool. Priority: must-have
  > Socrates: Counter-argument considered: "Full account-based auth (restore the Supabase module) is more robust." Resolution: rejected for v1. The need is a privacy gate on a public URL for a single owner, not multi-user identity. An edge-level passphrase keeps the "data stays local" guarantee fully intact (no server-side user records) and is the smallest change that meets the need. Account-based auth remains a v2 path only if the tool ever becomes multi-user.

## Non-Functional Requirements

- The generated output appears within 1 second of the user submitting the posting text, as perceived by the user.
- No base skill data or job posting content leaves the user's device.

## Business Logic

The app classifies each posting skill term as **matched** (maps to a base skill via synonym map) or **unmatched** (no mapping found), then assembles the matched base skills into a CV-ready skills section. The synonym map is the exclusive classification rule in v1 — no probabilistic inference, no scoring.

Inputs the rule consumes: (1) the user's declared base skills list, (2) the raw text of posting skill requirements, (3) the curated synonym map.
Output: (1) a formatted skills section containing only matched base skills, (2) a separate list of unmatched posting terms.

The user encounters the result immediately after submitting the posting text.

## Access Control

Single user. The app is publicly deployed (Cloudflare Workers), so a lightweight authentication gate restricts access to the owner only — a single shared passphrase checked at the edge, with no server-side user records and no multi-tenancy. Once past the gate, the user is immediately in the tool. Skill data and job posting content still live on-device only; the passphrase is the sole credential and is not skill data.

## Non-Goals

- **No LLM / AI matching in v1.** Rule-based synonym map only. LLM upgrade is the planned v2 path if the 75% match rate is not reached.
- **No other CV sections.** Only the skills section is generated. Education, work experience, summary, cover letter — all out of scope.
- **No PDF import or job posting scraping.** Input is manual paste only. No file upload, no URL-based scraping.
- **No multi-user, no mobile app.** Single user, web browser only. A single-passphrase access gate is in scope (FR-009); per-user accounts, multi-tenancy, and account-based auth (e.g. the removed Supabase module) are not.

## Open Questions

1. **`target_scale.qps` and `target_scale.data_volume` not explicitly captured.** Set to `low` and `small` respectively, inferred from the single-user personal tool context. Owner: user. Override if these assumptions are wrong.

2. **Tension between "Transparent matching" guardrail and FR-007 revision.** The guardrail states the user can see "which base skill mapped to which posting term and **why**." FR-007 was revised in the Socratic round: full per-match breakdown deferred to v2; only unmatched terms shown in v1. Confirm: in v1, does the user see (a) only the generated skills section + unmatched terms list, or (b) a per-term match explanation? Block: yes (acceptance criteria are ambiguous until resolved). Owner: user.

3. **Synonym map improvement path for the user.** FR-007 surfaces unmatched terms so the user can identify potential synonym map improvements. However, the synonym map is maintained by the developer (outside the app UI). Does the user have any in-app path to flag or request improvements, or is the unmatched terms list purely informational? Owner: user. By: before implementation of FR-007.
