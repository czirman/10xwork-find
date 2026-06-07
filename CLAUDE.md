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

CI (`.github/workflows/ci.yml`): lint + build on every push/PR to `main`.

## Architecture

**Astro 6 SSR app** with React 19 islands, Tailwind CSS 4, and shadcn/ui. Deployed to Cloudflare Workers via `@astrojs/cloudflare`.

### Rendering

`output: "server"` in `astro.config.mjs` — all pages server-rendered by default. API routes must export `const prerender = false` (already the Astro SSR default for API routes, but required if you ever override at page level).

### Auth & data

No authentication. This is a single-user, local-only tool: the user opens the app and is immediately in, and all data lives on the user's device (no auth, no server-side user data, no Supabase). There is no request middleware and no protected routes — the landing page (`src/pages/index.astro`) is the tool itself.

### Key conventions

- **Path alias**: `@/*` → `./src/*` (tsconfig paths). Always use this alias, never relative imports crossing directory boundaries.
- **Component split**: Astro components for static content/layout; React components only when interactivity is needed.
- **Tailwind CSS 4**: configured via `@tailwindcss/vite` Vite plugin — no `tailwind.config.*` file. Theme customizations and base styles go in `src/styles/global.css`.
- **Class merging**: use `cn()` from `@/lib/utils` (clsx + tailwind-merge). Never concatenate Tailwind class strings manually.
- **shadcn/ui**: components in `src/components/ui/`, "new-york" variant. Add new ones with `npx shadcn@latest add [name]`.
- **API routes**: export uppercase `GET`, `POST`, etc. Validate input with zod.
- **React**: no Next.js directives (`"use client"` etc.). Extract hooks to `src/components/hooks/`.
- **Services/helpers**: `src/lib/` (or `src/lib/services/` for business logic). Shared types (entities, DTOs) in `src/types.ts`.

### Environment

- Node.js v22.14.0 (`.nvmrc`)
- No runtime environment variables or external services — the app is fully local/on-device.
- Deploy: `npx wrangler deploy`

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->
