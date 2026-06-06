# Local-Only App Shell (Neutralize Auth Gate) — Plan Brief

> Full plan: `context/changes/local-only-app-shell/plan.md`

## What & Why

The `10x-astro-starter` ships a full Supabase auth scaffold, but the PRD declares
**no auth in scope** — a single user, data on-device only, who opens the app and is
immediately in. This change fully removes that scaffold and repoints the landing
page to a minimal tool shell, so nothing gates the app and no dead auth code can
silently re-gate it. It is roadmap **F-01**, the foundation that unlocks **S-01**
(manage base skills) and the north star **S-02** (generate tailored skills section).

## Starting Point

Today `/` renders the starter marketing page (`Welcome.astro`) whose only CTAs are
Sign In / Sign Up. A middleware gate (`src/middleware.ts`) protects `/dashboard`, and
a tight Supabase cluster (`lib/supabase`, `lib/config-status`, `auth/*` pages, six
`components/auth/*`, three `api/auth/*` routes, a config-warning banner, env schema,
three npm deps) sits unused relative to the actual skills tool. No tests touch auth.

## Desired End State

Opening `/` lands the user directly in a minimal, on-device tool shell (app title +
an empty container that S-01 will fill) — no login wall, no auth CTAs, no banner. The
Supabase scaffold is gone: no middleware, no `/auth/*` or `/dashboard`, no
`lib/supabase`, no Supabase deps or env schema. `CLAUDE.md` and `README.md` no longer
describe auth as part of the app.

## Key Decisions Made

| Decision                  | Choice                                              | Why (1 sentence)                                                            | Source |
| ------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| Removal depth             | Full removal of the entire auth cluster             | Roadmap warns "neutralize, don't half-remove"; dormant files re-mislead.   | Plan   |
| npm Supabase deps         | Remove all three from `package.json`                | Tech-stack calls Supabase "left unused, deliberate"; lighter lockfile.     | Plan   |
| Landing shell scope       | Minimal placeholder (title + empty container)       | Progressive disclosure — the skills UI belongs to S-01, not F-01.          | Plan   |
| Doc hygiene               | Sweep all `CLAUDE.md`/`README.md` auth refs + banner| Prevent stale docs from re-misleading a future agent.                      | Plan   |
| Phase order               | Repoint landing *before* deleting auth routes       | Avoids a manual-gate state where the landing has dead Sign In/Up CTAs.     | Plan   |

## Scope

**In scope:** delete middleware/auth pages/auth API/auth components/dashboard; delete
`lib/supabase` + `config-status` + `Banner`; remove env schema, `Locals.user`,
`supabase/` dir, `.env.example` keys, CI secret injection, three npm deps; repoint
`index.astro` to a minimal shell; sweep `CLAUDE.md` + `README.md`.

**Out of scope:** the skills management UI (S-01); matching/posting logic (S-02);
browser-local persistence; any `Layout.astro` redesign beyond banner + title.

## Architecture / Approach

Four phases, each leaving a green build, ordered to avoid confusing intermediate
states: **(1)** repoint the landing + drop marketing components → **(2)** delete the
gate + every auth route/component → **(3)** strip the now-orphaned Supabase library,
config, env schema, and deps → **(4)** sweep the docs and prove removal with a
repo-wide grep.

## Phases at a Glance

| Phase                          | What it delivers                                  | Key risk                                              |
| ------------------------------ | ------------------------------------------------- | ---------------------------------------------------- |
| 1. Repoint landing             | `/` is the tool shell; marketing components gone  | Over-building the shell into S-01's territory        |
| 2. Remove auth routes/gate/UI  | No gate, no `/auth/*`, no `/dashboard`            | Missing a file that still imports `lib/supabase`     |
| 3. Strip Supabase lib/config/deps | Orphaned library, env schema, deps removed     | Empty `Locals` tripping lint; lockfile drift         |
| 4. Documentation hygiene       | Docs describe a no-auth app; grep proves removal  | Missing one of ~6 `CLAUDE.md` Supabase touchpoints   |

**Prerequisites:** none (F-01 has no upstream roadmap dependency; build is green today).
**Estimated effort:** ~1 session across 4 small, mostly-deletion phases.

## Open Risks & Assumptions

- **Assumption:** the build does not need the Supabase secrets (envFields are
  `optional: true`; `createClient` returns `null` without them) — so removing the env
  schema and CI injection breaks nothing. Verified by reading the config.
- **Risk:** `README.md` auth copy may be entangled with broader starter prose; if it
  can't be cleanly excised it's flagged for follow-up rather than forcing a rewrite.
- **CI secrets** remain in repo settings as harmless no-ops; deleting them is the repo
  owner's optional out-of-band step.

## Success Criteria (Summary)

- Opening `/` lands directly in the tool shell — no login, no auth CTAs, no banner.
- `/auth/*` and `/dashboard` 404; no middleware gate remains.
- `npm run build`, `npm run lint`, `npm run test:run` pass; repo-wide `grep -rin
  supabase` (excluding `node_modules`/`.git`/`context`/`package-lock.json`) is clean.
