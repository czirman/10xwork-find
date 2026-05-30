# Local-Only App Shell (Neutralize Auth Gate) Implementation Plan

## Overview

The `10x-astro-starter` ships a full Supabase auth scaffold — middleware gate,
sign-in/up/confirm pages, auth API routes, a protected dashboard, and a marketing
landing page (`Welcome.astro`) whose only calls-to-action are Sign In / Sign Up.
The PRD declares **no auth in scope**: a single user, data on-device only, who
opens the app and is immediately in. This change **fully removes** that scaffold
and repoints the landing page to a minimal tool shell, so nothing gates the app
and no dead auth code can silently re-gate it later.

This is roadmap **F-01**, the foundation that unlocks **S-01** (manage base
skills) and the north star **S-02** (generate tailored skills section).

## Current State Analysis

The auth scaffold is a tight, self-contained cluster with a clear dependency
graph and **zero test blast radius** (`src/lib/utils.test.ts` and
`src/test/setup.ts` reference nothing auth-related):

- **Gate:** `src/middleware.ts:4,18-22` — builds a Supabase client per request,
  sets `context.locals.user`, redirects `/dashboard` → `/auth/signin` when
  unauthenticated. `/` (index) is *not* currently gated, but it renders the
  starter marketing page.
- **Supabase library:** `src/lib/supabase.ts` (client factory, reads
  `astro:env/server` secrets) and `src/lib/config-status.ts` (reads the same
  secrets, drives a config-warning banner). Consumers: `middleware.ts`, the three
  `src/pages/api/auth/*.ts` routes, and `src/layouts/Layout.astro` (via
  `config-status` → `Banner`).
- **Auth UI leaves:** `src/pages/auth/{signin,signup,confirm-email}.astro`,
  `src/components/auth/*` (6 form components), `src/pages/dashboard.astro`.
- **Landing:** `src/pages/index.astro` → `src/components/Welcome.astro` (imports
  `Topbar.astro`; hero titled "10x Astro Starter" with Sign In / Sign Up CTAs).
- **Dead-weight config/docs:** `Layout.astro` shows a Polish banner "Supabase nie
  jest skonfigurowany…" on every page; `astro.config.mjs:17-22` declares
  `SUPABASE_URL/KEY` envFields (`optional: true`); `package.json` carries
  `@supabase/ssr`, `@supabase/supabase-js`, `supabase` (CLI); `supabase/config.toml`
  exists (no migrations); `.env.example` lists the two secrets; `.github/workflows/ci.yml:22-24`
  injects them into the build; `CLAUDE.md` documents the auth flow as load-bearing
  in ~6 places.

### Key Discoveries:

- The envFields are `optional: true` (`astro.config.mjs:19-20`) and
  `createClient` returns `null` when secrets are absent (`src/lib/supabase.ts:6-8`),
  so **the build already does not require the secrets** — removing the env schema
  and the CI injection is safe and breaks nothing.
- `context.locals.user` is read by `middleware.ts`, `components/Topbar.astro:2`,
  and `dashboard.astro:4` — all deleted by Phase 2 (Topbar in Phase 1, middleware +
  dashboard in Phase 2), before the `Locals.user` type drop in `src/env.d.ts` in
  Phase 3. So dropping the type is safe; no reader survives the change (final guard:
  `grep -rn "locals" src/` returns nothing in Phase 3).
- `Topbar.astro` is imported only by `Welcome.astro`; `Banner.astro` only by
  `Layout.astro`; `config-status.ts` only by `Layout.astro` — clean leaf removals.
- No test references auth; the only tests are `utils.test.ts`.

## Desired End State

Opening `/` lands the user directly in a minimal, on-device tool shell (app title
+ an empty container that S-01 will fill) — no login wall, no Sign In / Sign Up
CTAs, no config-warning banner. The Supabase auth scaffold is **gone**: no
middleware gate, no `/auth/*` or `/dashboard` routes, no `api/auth/*`, no
`lib/supabase`, no Supabase npm dependencies, no Supabase env schema. Docs
(`CLAUDE.md`, `README.md`) no longer describe Supabase/auth as part of the app.

**Verification of end state:** `npm run build`, `npm run lint`, and
`npm run test:run` all pass; a repo-wide `grep -rin supabase` (excluding
`node_modules`, `.git`, `context/`, `package-lock.json`) returns no hits;
`grep -rn "locals" src/` returns nothing; visiting `/` shows the tool shell.

## What We're NOT Doing

- **Not building the skills UI.** The landing is a placeholder shell only; the
  add/edit/delete skills surface is S-01's job (progressive disclosure).
- **Not building any matching / posting logic.** That is S-02.
- **Not introducing browser-local persistence.** S-01 owns the storage decision.
- **Not keeping any auth code "dormant."** Full removal was chosen specifically to
  avoid the "half-remove" failure the roadmap warns about.
- **Not redesigning `Layout.astro`'s structure** beyond removing the banner and
  fixing the default title.

## Implementation Approach

Four phases, each leaving a **green build**, ordered so no intermediate state is
confusing at the manual gate:

1. **Repoint the landing first** — so the moment the auth routes disappear in
   Phase 2 there is no landing page pointing Sign In / Sign Up at deleted routes.
2. **Remove the auth routes, gate, and UI** — every file that imports
   `lib/supabase` plus the auth pages/components and the protected dashboard.
3. **Strip the Supabase library, config, and dependencies** — now orphaned.
4. **Documentation hygiene** — sweep *every* Supabase/auth reference out of
   `CLAUDE.md` and `README.md`, then prove full removal with a repo-wide grep.

> Note: this reverses the order presented during planning (landing repoint moved
> ahead of route deletion) on advisor input — a pure sequencing improvement so the
> Phase 2 manual gate never shows dead CTAs. Scope is unchanged.

## Phase 1: Repoint landing to tool shell

### Overview

Replace the starter marketing landing with a minimal tool shell and remove the
marketing components, so `/` is "the tool, not the Welcome page."

### Changes Required:

#### 1. Landing page

**File**: `src/pages/index.astro`

**Intent**: Stop rendering the marketing `Welcome` component; render a minimal
app shell inside `Layout` — an app title heading and an empty container that S-01
will populate with the base-skills UI. No auth CTAs, no feature cards.

**Contract**: Page renders `<Layout>` wrapping a single semantic shell (heading
with the app's working name + an empty `<main>`/container placeholder). Imports
no auth/marketing components.

#### 2. Layout default title

**File**: `src/layouts/Layout.astro`

**Intent**: Change the default `title` prop from "10x Astro Starter" to the app's
working name so the browser tab no longer reads as the starter.

**Contract**: `const { title = "<app name>" }` default updated. (Banner removal is
Phase 3.)

#### 3. Delete marketing components

**Files**: `src/components/Welcome.astro`, `src/components/Topbar.astro`

**Intent**: Remove the starter marketing landing and its topbar; both are now
unreferenced once index is repointed.

**Contract**: Files deleted. No remaining imports of `Welcome` or `Topbar`.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Lint passes: `npm run lint`
- No imports/usages of deleted components: `grep -rn "Welcome.astro\|Topbar.astro\|<Welcome\|<Topbar" src/` returns nothing (a bare `Welcome\|Topbar` grep would false-positive on the "Welcome," prose in `dashboard.astro`, which is not deleted until Phase 2)
- No auth links remain on the landing: `grep -rn "/auth/sign" src/pages/index.astro` returns nothing

#### Manual Verification:

- Visiting `/` shows the minimal tool shell (app title + empty container), not the "10x Astro Starter" cosmic hero
- No Sign In / Sign Up buttons anywhere on the landing
- Browser tab title reflects the app, not the starter

**Implementation Note**: After completing this phase and all automated
verification passes, pause for manual confirmation from the human before
proceeding to Phase 2.

---

## Phase 2: Remove auth routes, gate & UI

### Overview

Delete the middleware gate and every auth-facing route and component. After this
phase, `lib/supabase.ts` is orphaned (removed in Phase 3) but the build stays
green.

### Changes Required:

#### 1. Middleware gate

**File**: `src/middleware.ts`

**Intent**: Remove the request middleware entirely — it exists only to create the
Supabase client and gate `/dashboard`. With no protected routes, Astro needs no
middleware.

**Contract**: File deleted.

#### 2. Auth pages

**Files**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`

**Intent**: Remove the sign-in/up/confirm UI pages.

**Contract**: Files deleted; `src/pages/auth/` removed.

#### 3. Auth API routes

**Files**: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`, `src/pages/api/auth/signout.ts`

**Intent**: Remove the auth endpoints (all import `lib/supabase`).

**Contract**: Files deleted; `src/pages/api/auth/` removed.

#### 4. Auth form components

**Files**: `src/components/auth/{FormField,PasswordToggle,ServerError,SignInForm,SignUpForm,SubmitButton}.tsx`

**Intent**: Remove the six React auth form components.

**Contract**: Files deleted; `src/components/auth/` removed.

#### 5. Protected dashboard

**File**: `src/pages/dashboard.astro`

**Intent**: Remove the only protected page (the sole reader of `locals.user`).

**Contract**: File deleted.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Lint passes: `npm run lint`
- Auth routes/components gone: `ls src/pages/auth src/pages/api/auth src/components/auth src/pages/dashboard.astro src/middleware.ts` errors on every path
- No imports of deleted auth surface: `grep -rn "components/auth\|api/auth\|/dashboard" src/` returns nothing

#### Manual Verification:

- Navigating to `/auth/signin`, `/auth/signup`, `/dashboard` returns a 404 (no redirect loop, no gate)
- `/` still renders the tool shell from Phase 1
- No console errors on the landing

**Implementation Note**: After completing this phase and all automated
verification passes, pause for manual confirmation from the human before
proceeding to Phase 3.

---

## Phase 3: Strip Supabase library, config & dependencies

### Overview

Remove the now-orphaned Supabase library, the config-warning banner, the env
schema, the npm dependencies, and the stray Supabase config/CI references.

### Changes Required:

#### 1. Supabase library & banner

**Files**: `src/lib/supabase.ts`, `src/lib/config-status.ts`, `src/components/Banner.astro`

**Intent**: Delete the Supabase client factory, the config-status helper, and the
banner component it fed.

**Contract**: Files deleted.

#### 2. Layout banner removal

**File**: `src/layouts/Layout.astro`

**Intent**: Remove the `Banner` import, the `missingConfigs` import, and the
`missingConfigs.map(...)` block so the layout renders a clean shell.

**Contract**: `Layout.astro` no longer imports `Banner` or `config-status`; body
renders only `<slot />` (plus existing `<head>`/`<style>`).

#### 3. Env schema

**File**: `astro.config.mjs`

**Intent**: Remove the `env: { schema: { SUPABASE_URL, SUPABASE_KEY } }` block —
no code reads `astro:env/server` after the library is gone.

**Contract**: `env` block removed; `envField` import dropped if now unused.

#### 4. Locals type

**File**: `src/env.d.ts`

**Intent**: Drop the `user` field from `App.Locals` (its only reader,
`dashboard.astro`, is deleted).

**Contract**: `Locals.user` removed. If an empty `interface Locals {}` trips the
lint rule, remove the `App` namespace declaration entirely — Astro does not
require it.

#### 5. npm dependencies

**File**: `package.json` (+ `package-lock.json`)

**Intent**: Remove `@supabase/ssr`, `@supabase/supabase-js`, and the `supabase`
CLI dependency, then refresh the lockfile.

**Contract**: Three Supabase entries removed from `package.json`; `npm install`
run to update `package-lock.json`.

#### 6. Stray config & CI

**Files**: `supabase/config.toml`, `.env.example`, `.github/workflows/ci.yml`

**Intent**: Delete the `supabase/` directory, remove the `SUPABASE_URL/KEY` lines
from `.env.example`, and remove the `SUPABASE_URL/KEY` env injection from the
CI build step(s).

**Contract**: `supabase/` removed; `.env.example` has no Supabase keys; `ci.yml`
build step(s) no longer reference `secrets.SUPABASE_*`.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Lint passes: `npm run lint`
- Tests pass: `npm run test:run`
- No Supabase env usage in source: `grep -rn "astro:env" src/` returns nothing
- No Supabase deps remain: `grep -n "supabase" package.json` returns nothing
- No straggler `locals` reader: `grep -rn "locals" src/` returns nothing
- `supabase/` directory is gone: `ls supabase` errors

#### Manual Verification:

- `/` renders cleanly with no config-warning banner at the top
- App still loads and looks identical to end of Phase 1 (banner aside)
- A fresh `npm install` from the updated lockfile succeeds without Supabase packages

**Implementation Note**: After completing this phase and all automated
verification passes, pause for manual confirmation from the human before
proceeding to Phase 4.

---

## Phase 4: Documentation hygiene

### Overview

Sweep every Supabase/auth reference out of the project docs so a future agent is
never misled into treating auth as load-bearing, then prove full removal with a
repo-wide grep.

### Changes Required:

#### 1. CLAUDE.md — full sweep

**File**: `CLAUDE.md`

**Intent**: Remove/replace **every** Supabase and auth touchpoint, not just the
Auth-flow section. The known touchpoints: (a) the SSR-app summary line
("…Supabase Auth, and shadcn/ui"); (b) the `## Architecture` → "Auth flow"
section; (c) the CI line stating the build *requires* `SUPABASE_URL`/`SUPABASE_KEY`
secrets (now false); (d) `### Environment` → "Local Supabase: `npx supabase start`";
(e) the "Supabase migrations: `supabase/migrations/` … Always enable RLS…"
convention.

**Contract**: After the edit, `grep -in supabase CLAUDE.md` returns nothing. The
Auth-flow section is replaced by a short "No auth — single user, data on-device
only" note that matches the PRD Access Control.

#### 2. README.md — check & clean

**File**: `README.md`

**Intent**: The starter README likely carries auth/Supabase setup copy. Remove
stale auth/Supabase instructions, or — if entangled with broader starter prose —
update what's clearly about auth and flag any residual in the handoff.

**Contract**: No README section instructs the user to configure Supabase auth.
Any residual that can't be cleanly excised is noted for follow-up.

### Success Criteria:

#### Automated Verification:

- `CLAUDE.md` is clean: `grep -in supabase CLAUDE.md` returns nothing
- **Linchpin full-removal check** — `grep -rin supabase . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=context --exclude-dir=dist --exclude-dir=.astro --exclude=package-lock.json` returns no hits (excluding `dist`/`.astro` keeps the check on tracked source — both are gitignored build artifacts that can carry stale env-schema strings from earlier `npm run build` runs)
- Build still passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Reading `CLAUDE.md` cold, a new agent would not believe the app has auth
- `README.md` no longer tells a contributor to set up Supabase auth

**Implementation Note**: After completing this phase and all automated
verification passes, pause for final manual confirmation from the human.

---

## Testing Strategy

### Unit Tests:

- No new unit tests. The existing `src/lib/utils.test.ts` must continue to pass
  (`npm run test:run`) — it is unrelated to auth and acts as a regression guard
  that removals didn't break the build/test pipeline.

### Integration Tests:

- None automated. The integration surface is "the app loads and the landing is the
  tool" — covered by the build passing and manual route checks.

### Manual Testing Steps:

1. `npm run dev`, open `/` → confirm the minimal tool shell, no marketing hero, no
   auth CTAs, no config banner.
2. Navigate to `/auth/signin`, `/auth/signup`, `/dashboard` → each 404s (no
   redirect, no gate).
3. Confirm the browser tab title reflects the app, not "10x Astro Starter".
4. `rm -rf node_modules && npm install` → succeeds with no Supabase packages.

## Migration Notes

- **CI secrets:** `SUPABASE_URL` / `SUPABASE_KEY` repository secrets become
  unused once `ci.yml` stops injecting them. They can be left in the repo settings
  (harmless) or deleted by the repo owner out-of-band; the build no longer reads
  them either way.
- **No data migration:** the app has no live Supabase data (the layer was never
  wired); nothing to migrate.

## References

- Roadmap item: `context/foundation/roadmap.md` → **F-01: Local-only app shell**
- PRD: `context/foundation/prd.md` → `## Access Control` ("Single user; no auth;
  data lives on-device only"), `## Non-Functional Requirements` ("no base skill
  data or job posting content leaves the user's device")
- Tech stack: `context/foundation/tech-stack.md` (Supabase "left unused,
  deliberate")
- Gate being removed: `src/middleware.ts:4,18-22`
- Library being removed: `src/lib/supabase.ts:6-8`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Repoint landing to tool shell

#### Automated

- [x] 1.1 Build passes: `npm run build` — 3a58bb6
- [x] 1.2 Lint passes: `npm run lint` — 3a58bb6
- [x] 1.3 No imports/usages of deleted components: `grep -rn "Welcome.astro\|Topbar.astro\|<Welcome\|<Topbar" src/` returns nothing — 3a58bb6
- [x] 1.4 No auth links on landing: `grep -rn "/auth/sign" src/pages/index.astro` returns nothing — 3a58bb6

#### Manual

- [x] 1.5 `/` shows the minimal tool shell, not the starter hero — 3a58bb6
- [x] 1.6 No Sign In / Sign Up buttons on the landing — 3a58bb6
- [x] 1.7 Browser tab title reflects the app, not the starter — 3a58bb6

### Phase 2: Remove auth routes, gate & UI

#### Automated

- [x] 2.1 Build passes: `npm run build` — 655808d
- [x] 2.2 Lint passes: `npm run lint` — 655808d
- [x] 2.3 Auth routes/components gone (`ls` errors on every deleted path) — 655808d
- [x] 2.4 No imports of deleted auth surface: `grep -rn "components/auth\|api/auth\|/dashboard" src/` returns nothing — 655808d

#### Manual

- [x] 2.5 `/auth/signin`, `/auth/signup`, `/dashboard` all 404 (no redirect/gate) — 655808d
- [x] 2.6 `/` still renders the tool shell — 655808d
- [x] 2.7 No console errors on the landing — 655808d

### Phase 3: Strip Supabase library, config & dependencies

#### Automated

- [ ] 3.1 Build passes: `npm run build`
- [ ] 3.2 Lint passes: `npm run lint`
- [ ] 3.3 Tests pass: `npm run test:run`
- [ ] 3.4 No Supabase env usage: `grep -rn "astro:env" src/` returns nothing
- [ ] 3.5 No Supabase deps: `grep -n "supabase" package.json` returns nothing
- [ ] 3.6 No straggler `locals` reader: `grep -rn "locals" src/` returns nothing
- [ ] 3.7 `supabase/` directory gone: `ls supabase` errors

#### Manual

- [ ] 3.8 `/` renders with no config-warning banner
- [ ] 3.9 App loads identically to end of Phase 1 (banner aside)
- [ ] 3.10 Fresh `npm install` succeeds without Supabase packages

### Phase 4: Documentation hygiene

#### Automated

- [ ] 4.1 `CLAUDE.md` clean: `grep -in supabase CLAUDE.md` returns nothing
- [ ] 4.2 Linchpin: `grep -rin supabase . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=context --exclude-dir=dist --exclude-dir=.astro --exclude=package-lock.json` returns no hits
- [ ] 4.3 Build passes: `npm run build`
- [ ] 4.4 Lint passes: `npm run lint`

#### Manual

- [ ] 4.5 `CLAUDE.md` reads as a no-auth, local-only app
- [ ] 4.6 `README.md` no longer instructs Supabase auth setup
