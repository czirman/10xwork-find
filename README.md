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

All skill and posting data stays on-device; there are no external services.
The one piece of configuration is the access gate's shared passphrase
(`APP_PASSPHRASE`). For local dev, copy `.dev.vars.example` to `.dev.vars`
(git-ignored) and set a value:

```bash
cp .dev.vars.example .dev.vars
# then edit .dev.vars and set APP_PASSPHRASE=<your-local-passphrase>
```

`npm run dev` loads `.dev.vars` automatically. A missing/unset value fails
closed — every request is gated to the unlock page. See [Deployment](#deployment)
for the production secret.

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

### Access gate secret

The deployed app is protected by a single shared passphrase checked at the
edge (Astro middleware on the Worker). Set it once as a Cloudflare Worker
secret — out-of-band from the CI auto-deploy:

```bash
npx wrangler secret put APP_PASSPHRASE
```

- Use a **high-entropy** value (24+ random characters). With no rate limiting
  and an unsalted session-cookie hash, the passphrase entropy is the entire
  security model.
- A missing/unset secret **fails closed**: every request is redirected to the
  unlock page and every unlock attempt is rejected — set the secret in the same
  window as the deploy, or the live app locks everyone out.
- Local dev uses `.dev.vars` instead (see [Getting Started](#getting-started)).
- On success the unlock page issues a 30-day `HttpOnly`, `SameSite=Lax`,
  `Secure` (on HTTPS) session cookie; no server-side user records exist.

## CI

GitHub Actions runs lint + build on every push and PR to `main`.

## License

MIT
