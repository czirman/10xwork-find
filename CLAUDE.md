# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime via `astro dev`)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build locally
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes `prettier-plugin-astro` and `prettier-plugin-tailwindcss`)

Pre-commit: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

CI (`.github/workflows/ci.yml`): lint + build on every push/PR to `main`. Requires `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets for the build step.

## Architecture

**Astro 6 SSR app** with React 19 islands, Tailwind CSS 4, Supabase Auth, and shadcn/ui. Deployed to Cloudflare Workers via `@astrojs/cloudflare`.

### Rendering

`output: "server"` in `astro.config.mjs` — all pages server-rendered by default. API routes must export `const prerender = false` (already the Astro SSR default for API routes, but required if you ever override at page level).

### Auth flow

`src/lib/supabase.ts` creates a Supabase SSR client with cookie-based sessions. `SUPABASE_URL` and `SUPABASE_KEY` are declared as server-only secrets in the `astro:env` schema in `astro.config.mjs` — never exposed to the client.

`src/middleware.ts` runs on every request: resolves `context.locals.user` via `supabase.auth.getUser()` and redirects unauthenticated users away from any path listed in `PROTECTED_ROUTES`. Add protected paths there.

API endpoints live at `src/pages/api/auth/{signin,signup,signout}.ts`. Auth UI pages at `src/pages/auth/{signin,signup,confirm-email}.astro`. Protected page example: `src/pages/dashboard.astro`.

### Key conventions

- **Path alias**: `@/*` → `./src/*` (tsconfig paths). Always use this alias, never relative imports crossing directory boundaries.
- **Component split**: Astro components for static content/layout; React components only when interactivity is needed.
- **Tailwind CSS 4**: configured via `@tailwindcss/vite` Vite plugin — no `tailwind.config.*` file. Theme customizations and base styles go in `src/styles/global.css`.
- **Class merging**: use `cn()` from `@/lib/utils` (clsx + tailwind-merge). Never concatenate Tailwind class strings manually.
- **shadcn/ui**: components in `src/components/ui/`, "new-york" variant. Add new ones with `npx shadcn@latest add [name]`.
- **API routes**: export uppercase `GET`, `POST`, etc. Validate input with zod.
- **React**: no Next.js directives (`"use client"` etc.). Extract hooks to `src/components/hooks/`.
- **Services/helpers**: `src/lib/` (or `src/lib/services/` for business logic). Shared types (entities, DTOs) in `src/types.ts`.
- **Supabase migrations**: `supabase/migrations/` with format `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS with per-operation, per-role policies on new tables.

### Environment

- Node.js v22.14.0 (`.nvmrc`)
- Copy `.env.example` → `.env` (Node) or `.dev.vars` (Cloudflare local dev; gitignored)
- Local Supabase: `npx supabase start` (requires Docker; Studio at `http://localhost:54323`)
- Deploy: `npx wrangler deploy`

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 2

Turn one roadmap item into the first implementation cycle with the **change planning chain**:

```
/10x-roadmap -> /10x-new -> /10x-plan -> /10x-plan-review -> /10x-implement
```

`/10x-new`, `/10x-plan`, `/10x-plan-review`, and `/10x-implement` are the lesson focus. `/10x-frame` and `/10x-research` are not required rituals here; they are escalation paths introduced in the next lesson.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Change setup (lesson focus)** | |
| `/10x-new <change-id>` | You selected a roadmap item and need a stable change folder. Creates `context/changes/<change-id>/change.md` so planning, implementation, progress, commits, and later review all share one identity. Use AFTER roadmap selection, BEFORE `/10x-plan`. |
| **Planning (lesson focus)** | |
| `/10x-plan <change-id>` | You have a change folder and need a reviewable implementation plan. Reads roadmap context, foundation docs, codebase evidence, and any existing change notes; writes `plan.md` and `plan-brief.md` with phases, file contracts, success criteria, and `## Progress`. |
| **Plan readiness (lesson focus)** | |
| `/10x-plan-review <change-id>` | You have `plan.md` and need a light pre-code readiness check. Use it to catch missing end state, weak contracts, malformed progress, scope drift, or blind spots before code changes begin. |
| **Implementation (lesson focus)** | |
| `/10x-implement <change-id> phase <n>` | You have an approved plan and want to execute one phase with verification, manual gate, commit ritual, and SHA write-back to `## Progress`. |
| **Lifecycle closure** | |
| `/10x-archive <change-id>` | A change is merged or intentionally closed. Move it out of active `context/changes/` into archive state. |

### How the chain hands off

- `/10x-new` creates the durable change identity.
- `/10x-plan` turns that identity into an implementation contract.
- `/10x-plan-review` checks the plan before the agent mutates code.
- `/10x-implement` executes one planned phase, verifies, asks for manual confirmation when needed, commits, and records progress.

### Lesson boundaries

- Plan is the default router after roadmap selection. Start with `/10x-plan` unless the problem is unclear or external evidence is blocking.
- Do not run `/10x-frame + /10x-research` as ceremony for every change.
- Do not turn this lesson into a full end-to-end product build. A checkpoint with a planned and partially or fully implemented stream is valid.
- Code review of the implemented diff belongs to Lesson 3 via `/10x-impl-review`.
- Lifecycle closure via `/10x-archive` after a change is merged or intentionally closed.

### Paths used by this lesson

- `context/foundation/roadmap.md` - upstream roadmap
- `context/changes/<change-id>/change.md` - change identity
- `context/changes/<change-id>/plan.md` - implementation contract
- `context/changes/<change-id>/plan-brief.md` - compressed handoff
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
