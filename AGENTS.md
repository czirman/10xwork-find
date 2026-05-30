# Repository Guidelines

Astro 6 SSR app with React 19 islands, Tailwind CSS 4, and shadcn/ui, deployed to Cloudflare Workers via `@astrojs/cloudflare`. Single-user, local-only tool — no auth, no backend; all data lives on the user's device.

## Hard Rules

- Always use the `@/*` path alias (`@/*` → `src/*`). Never use relative imports that cross directory boundaries.
- Never concatenate Tailwind class strings manually — use `cn()` from `@/lib/utils`.

## Project Structure

Source in `src/`: pages and API routes (`src/pages/`, the index page is the tool), React islands (`src/components/`, hooks in `src/components/hooks/`), shadcn/ui "new-york" components (`src/components/ui/`), helpers (`src/lib/`, business logic in `src/lib/services/`), shared types in `src/types.ts`. Tailwind entry: `src/styles/global.css`. See `@CLAUDE.md` for architecture details.

## Commands

- `npm run dev` — dev server (Cloudflare workerd runtime)
- `npm run build` — production build
- `npm run lint` / `npm run lint:fix` — ESLint with type-checked rules
- `npm run format` — Prettier (120-char width)
- `npm run test:run` — single Vitest run; `npm run test` for watch mode

No runtime environment variables or external services — the app runs fully local.

## Coding Conventions

- Tailwind 4: configured via `@tailwindcss/vite` Vite plugin; no `tailwind.config.*` file exists. Theme customizations go in `src/styles/global.css`.
- Shared types (entities, DTOs): `src/types.ts`.

## Testing

Vitest + `@testing-library/react`, jsdom environment. Tests: `src/**/*.test.{ts,tsx}`. Run one file: `npm run test:run -- src/path/to/file.test.ts`. Config: `@vitest.config.ts`.

## CI

Lint + build on push/PR to `main` (`@.github/workflows/ci.yml`). Pre-commit: husky + lint-staged runs ESLint fix + Prettier automatically.
