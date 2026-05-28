# Repository Guidelines

Astro 6 SSR app with React 19 islands, Tailwind CSS 4, Supabase Auth, and shadcn/ui, deployed to Cloudflare Workers via `@astrojs/cloudflare`.

## Hard Rules

- Always use the `@/*` path alias (`@/*` → `src/*`). Never use relative imports that cross directory boundaries.
- Never concatenate Tailwind class strings manually — use `cn()` from `@/lib/utils`.


- Every new Supabase table must enable RLS with per-operation, per-role policies.
- Add protected routes to `PROTECTED_ROUTES` in `src/middleware.ts`; never implement auth guards inline in pages.

## Project Structure

Source in `src/`: pages and API routes (`src/pages/`), React islands (`src/components/`, hooks in `src/components/hooks/`), shadcn/ui "new-york" components (`src/components/ui/`), helpers (`src/lib/`, business logic in `src/lib/services/`), shared types in `src/types.ts`. Auth middleware: `src/middleware.ts`. Tailwind entry: `src/styles/global.css`. Migrations: `supabase/migrations/`. See `@CLAUDE.md` for auth flow and API route details.

## Commands

- `npm run dev` — dev server (Cloudflare workerd runtime)
- `npm run build` — production build; requires `SUPABASE_URL` + `SUPABASE_KEY`
- `npm run lint` / `npm run lint:fix` — ESLint with type-checked rules
- `npm run format` — Prettier (120-char width)
- `npm run test:run` — single Vitest run; `npm run test` for watch mode

Copy `.env.example` → `.env` (Node) or `.dev.vars` (Cloudflare local dev, gitignored).

## Coding Conventions

- Tailwind 4: configured via `@tailwindcss/vite` Vite plugin; no `tailwind.config.*` file exists. Theme customizations go in `src/styles/global.css`.
- Shared types (entities, DTOs): `src/types.ts`.

## Testing

Vitest + `@testing-library/react`, jsdom environment. Tests: `src/**/*.test.{ts,tsx}`. Run one file: `npm run test:run -- src/path/to/file.test.ts`. Config: `@vitest.config.ts`.

## Supabase Migrations

Naming: `supabase/migrations/YYYYMMDDHHmmss_short_description.sql`. per-role policies on new tables.

## CI

Lint + build on push/PR to `main` (`@.github/workflows/ci.yml`). Build requires `SUPABASE_URL` and `SUPABASE_KEY` repository secrets. Pre-commit: husky + lint-staged runs ESLint fix + Prettier automatically.
