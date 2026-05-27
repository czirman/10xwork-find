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

