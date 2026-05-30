# 10xwork-find

A single-user, local-only tool that tailors the **skills section** of a CV to a
specific job posting. Paste a posting's raw skill requirements and get back a
CV-ready skills section drawn only from your own declared base skills, expressed
in the posting's vocabulary via a curated synonym map. All data stays on your
device — there is no account and no backend.

## Tech Stack

- [Astro](https://astro.build/) v6 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run dev
```

The app has no runtime environment variables or external services — it runs
fully local with no configuration.

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages (index is the tool)
│ ├── components/ # UI components (Astro & React)
│ └── lib/ # Helpers and business logic
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/).

1. Build the project:

```bash
npm run build
```

2. Deploy with Wrangler:

```bash
npx wrangler deploy
```

## CI

GitHub Actions runs lint + build on every push and PR to `main`.

## License

MIT
