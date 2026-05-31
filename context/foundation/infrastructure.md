---
project: 10xwork-find
researched_at: 2026-05-28
recommended_platform: Cloudflare Workers
runner_up: Netlify
context_type: mvp
tech_stack:
  language: JavaScript / TypeScript
  framework: Astro 6.3.1
  runtime: Cloudflare Workers (workerd / V8 isolates)
  adapter: "@astrojs/cloudflare v13.5.0"
  database: none (all data in browser localStorage)
---

## Recommendation

**Deploy on Cloudflare Workers.**

The project is already wired for Cloudflare Workers: `@astrojs/cloudflare` v13.5.0 targets Workers (not Pages — Pages SSR was removed in v13), `wrangler.jsonc` uses the Workers entrypoint, the `nodejs_compat` flag is set, and static assets are configured at `./dist`. The free tier (100,000 requests/day) covers this single-user personal tool indefinitely with zero cost. The user has existing Cloudflare familiarity, the platform has the richest GA MCP ecosystem among all candidates, and `wrangler` v4.90.0 is already in the project's devDependencies — no additional tooling install required.

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass | **10/10** |
| **Netlify** | Pass | Pass | Pass | Pass | Pass | **10/10** |
| **Vercel** | Pass | Pass | Pass | Pass | Partial | **9/10** |
| Fly.io | Pass | Partial | Partial | Pass | Partial | 7/10 |
| Render | Partial | Pass | Pass | Partial | Partial | 7/10 |
| Railway | Partial | Pass | Partial | Partial | Partial | 6/10 |

**Hard filters applied:** No persistent connections required → no platforms dropped. All support JavaScript/TypeScript Astro 6 SSR (different adapters; `@astrojs/cloudflare` for Cloudflare Workers, `@astrojs/node` for the rest).

**Soft weight adjustments:** User is familiar with Cloudflare → tie-breaker favors Cloudflare over Netlify (both score 10/10). Co-location preference noted but moot — PRD hard requirement ("data stays local") means no server-side storage is needed at any platform.

### Scoring notes per criterion

**CLI-first:** Cloudflare, Vercel, Netlify, and Fly.io all fully pass — every routine operation (deploy, rollback, log tail) has a single non-interactive command. Railway and Render score Partial because rollbacks require the dashboard or REST API; no CLI `rollback` subcommand exists on either.

**Managed/Serverless:** Cloudflare, Vercel, Netlify, Railway, and Render all pass — they abstract OS, TLS, and routing. Fly.io scores Partial: it runs managed micro-VMs, but Dockerfiles are required for SSR and bring a small ops surface that pure-serverless platforms avoid.

**Agent-readable docs:** Cloudflare, Vercel, Netlify, and Render all publish `llms.txt` / `llms-full.txt` or structured markdown access. Fly.io and Railway score Partial — their docs are GitHub-sourced Markdown (agent-readable in practice) but without a published `llms.txt` endpoint.

**Stable deploy API:** Cloudflare, Vercel, Netlify, and Fly.io all pass — one command, deterministic exit code, rollback by command or image ID. Railway and Render score Partial because rollbacks are not CLI-scriptable.

**MCP / Integration:** Cloudflare's MCP ecosystem is the most mature (multiple GA servers: API, Docs, Workers Builds, Observability, Radar, etc.). Netlify ships a write-capable `@netlify/mcp` (GA Feb 2025). All others score Partial: Vercel MCP is read-only beta; Fly.io MCP is experimental; Railway remote MCP is a work-in-progress; Render MCP can't trigger deploys.

---

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Already the configured deployment target (adapter + wrangler config are in place). Free tier is 100k requests/day — unlimited for a single-user personal tool. The richest GA MCP ecosystem of any platform researched, covering deployments, observability, docs, and Workers bindings. `wrangler deploy`, `wrangler rollback`, and `wrangler tail` cover the full operational loop from the CLI. User has existing Cloudflare familiarity, eliminating the onboarding cost that would apply to any other platform.

#### 2. Netlify

Tied score (10/10) with the strongest write-capable MCP story of any platform (`@netlify/mcp` GA since February 2025 — supports deploy, env vars, project management, not just read access). Free tier generously covers this traffic profile (300 credits/month; 10k–100k requests cost 2–20 credits). Serverless Functions handle Astro SSR via `@astrojs/netlify` v7. The gap vs. Cloudflare is purely familiarity and the fact that switching requires swapping the Astro adapter and rewriting the wrangler config.

#### 3. Vercel

Near-perfect score (9/10). The best agent-readable docs story (`llms-full.txt` explicitly optimized for LLM consumption). Generous Hobby free tier (1M invocations/month). CLI logs were rebuilt in February 2026 specifically for agent workflows. MCP is available but read-only (public beta, launched 2025-08-06) — drops it below Cloudflare and Netlify on the MCP criterion. Hobby plan is restricted to non-commercial use (fits a personal tool). Switching requires the `@astrojs/vercel` adapter.

---

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **Pages→Workers adapter breakage is a live trap.** The tech-stack.md says `cloudflare-pages` as the deployment target, but `@astrojs/cloudflare` v13+ removed Pages SSR. Every tutorial written before 2025 points to `wrangler pages deploy`. Using the wrong command deploys a non-functional site with a confusing error. Getting CI wired correctly requires reading the v13 migration guide specifically, not the Astro quickstart.

2. **workerd is not Node.js and the polyfill gap bites unpredictably.** The `nodejs_compat` flag covers most standard APIs, but a transitive dependency calling `path.resolve` in an unexpected code path, or using `Buffer` via a non-standard import, will fail at runtime, not build time. You discover the breakage on first real deploy, not during `npm run build`.

3. **Free tier 10ms CPU cap is per-invocation with zero burst.** Unlike traditional serverless where CPU quota is a monthly pool, Workers free tier enforces exactly 10ms of CPU time per invocation. A synonym match over a 50+ term job posting with complex regex patterns can exceed this on slower edge PoPs. The error is a platform `1101 Exceeded CPU limit` — not a 500, making it confusing to debug. Workers Standard ($5/mo) removes the limit.

4. **Open hybrid-SSR bug (#15237) on Astro 6 + Workers.** If any routes use `prerender = true` in the SSR app, there is an open GitHub issue that causes these routes to break on Cloudflare Workers under Astro 6. Routes must stay fully SSR or the bug must be confirmed resolved before mixing `prerender = true`.

5. **`@astrojs/cloudflare` patch versions include breaking changes.** Minor-version bumps in v13 have included removal of config options (`cloudflareModules`), changes to image service defaults, and changes to how `Astro.locals.runtime` works. Without pinning the adapter version in `package.json`, a `npm install` in CI can upgrade it and break the build silently.

### Pre-Mortem — How This Could Fail

Six months in, the Cloudflare Workers deploy has become a persistent source of friction. The first problem arrived during the initial CI setup: the CI pipeline was wired to `wrangler pages deploy` based on an outdated GitHub Actions template — the adapter had dropped Pages support but the error message pointed at a missing `_worker.js` file, not the real cause. A day lost.

Once on the correct Workers path, the build worked locally but failed in production. A transitive dependency in the synonym matching logic imported `path` in a code path the type checker didn't flag. The `nodejs_compat` flag covered `path.join` but not the specific `path.posix.normalize` call buried in the library. Two days debugging a library the developer didn't own.

Then the free tier CPU limit emerged. The synonym matching code ran in 2ms on the developer's M3 Max. On Cloudflare's Frankfurt PoP under the free tier, complex postings hit 11ms and returned `1101` errors. Upgrading to Workers Standard ($5/mo) fixed it, but the "free" MVP promise evaporated. Finally, a Dependabot PR bumped `@astrojs/cloudflare` from 13.5.0 to a later patch that changed how env vars are accessed, and the next deploy broke silently until a manual page visit surfaced an error.

### Unknown Unknowns

- **Static asset wiring is not automatic in Workers (unlike Pages).** In Pages, the CDN served static assets automatically. In Workers with `@astrojs/cloudflare` v13+, the `assets.directory` key in `wrangler.jsonc` must be explicitly set (it is already set to `./dist` in this project — but worth confirming it stays correct after build output changes).

- **`.dev.vars` env var access changed in v13.** The old `Astro.locals.runtime.env.VAR_NAME` accessor no longer works via the adapter abstraction; env vars are now accessed directly through the Workers runtime. Pre-2025 Astro+Cloudflare tutorial snippets for env access are silently wrong.

- **`wrangler.jsonc` `name` field is the deployed Worker name.** The current config has `name: "10x-astro-starter"` (the starter template name, not the project name). This becomes the Worker's public name on Cloudflare. Update to `"10xwork-find"` or the desired Worker name before the first production deploy to avoid inheriting the template's name.

- **`wrangler tail` enters sampling mode under concurrent load.** For a personal tool with one user this is effectively irrelevant — but if another Worker on the same account is busy, the tail can start sampling and warn. Not a blocking issue, just surprising.

- **10ms CPU cap applies to wall time on the free tier, not CPU-only cycles.** Slow network connections holding a Worker open while it processes count against the invocation's CPU budget. Developer hardware masks this because local `astro dev` doesn't enforce the limit.

---

## Operational Story

- **Preview deploys:** `wrangler deploy --env preview` (requires a `[env.preview]` stanza in `wrangler.jsonc`). Alternatively, every PR branch can be deployed to a named Worker (`10xwork-find-pr-42`) for manual QA. No built-in preview URL system like Vercel/Netlify — preview isolation requires explicit environment config or separate Worker names.

- **Secrets:** Environment variables live in Cloudflare's encrypted secrets store. Set with `wrangler secret put VAR_NAME` (interactive prompt) or `echo "value" | wrangler secret put VAR_NAME` (scriptable). For local dev, use `.dev.vars` (gitignored, same format as `.env`). This app needs no runtime environment variables (no server-side auth or DB). Rotation: `wrangler secret put VAR_NAME` overwrites the existing value; no downtime required.

- **Rollback:** `wrangler rollback` reverts to the previous deployed version. To roll back to a specific version: `wrangler rollback <version-id>` (list versions with `wrangler versions list`). Rollbacks are near-instant (no rebuild). Database migrations (if ever added) do not roll back automatically.

- **Approval:** Agent may perform unattended: deploy (`wrangler deploy`), rollback (`wrangler rollback`), log tail (`wrangler tail`), secret update (`wrangler secret put`). Human-only: delete a Worker (`wrangler delete`), transfer account ownership, billing tier changes.

- **Logs:** `wrangler tail 10xwork-find` streams live request logs with status codes, CPU time, and console output. Filter by status: `wrangler tail --status error`. Structured JSON output: `wrangler tail --format json`. Historical logs (past invocations) require Cloudflare Logpush (paid feature) or the Observability MCP server.

---

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| CI wired to `wrangler pages deploy` instead of `wrangler deploy` | Research finding | H (common mistake) | H (non-functional deploy) | CI workflow must use `wrangler deploy`; audit before first run. Current `wrangler.jsonc` uses Workers entrypoint — confirm CI command matches. |
| Transitive dependency uses CJS `require()` or unsupported Node API | Devil's advocate | M | M | Run `wrangler deploy --dry-run` in CI to catch runtime import errors before production; add `nodejs_compat` to `wrangler.jsonc` (already set). |
| Synonym matching exceeds 10ms CPU on free tier | Devil's advocate | M | M | Benchmark matching logic against the Workers simulator (`wrangler dev`); upgrade to Workers Standard ($5/mo) if CPU is hit. |
| Open hybrid-SSR bug (#15237) breaks prerendered routes | Research finding | L (only if `prerender=true` used) | H (silent breakage) | Keep all routes as `output: "server"` (current config); check GitHub issue status before adding any `prerender = true`. |
| `@astrojs/cloudflare` patch version breaks env access | Devil's advocate | M | M | Pin adapter version in `package.json` (`"@astrojs/cloudflare": "13.5.0"`, not `^13.5.0`); review changelog before upgrades. |
| Worker deployed under template name `10x-astro-starter` instead of project name | Unknown unknowns | H (default config) | L (cosmetic + URL confusion) | Update `wrangler.jsonc` `name` field to `"10xwork-find"` before first production deploy. |
| Pre-2025 env access pattern (`Astro.locals.runtime.env`) silently returns undefined | Unknown unknowns | M | M | Use Workers runtime env access directly; verify any env-var code against `@astrojs/cloudflare` v13 docs, not pre-2025 tutorials. |
| Free tier removed / pricing changed mid-project | Pre-mortem | L | L | Workers Standard is $5/mo — acceptable cost floor if free tier terms change. |

---

## Getting Started

The project is already configured for Cloudflare Workers. No adapter swap, no config rewrite — only authentication and the first deploy are outstanding.

1. **Authenticate Wrangler** (one-time, interactive — run this yourself in the terminal):
   ```
   ! npx wrangler login
   ```
   This opens a browser OAuth flow against your Cloudflare account.

2. **Update the Worker name** in `wrangler.jsonc` — change `"name": "10x-astro-starter"` to `"name": "10xwork-find"` (or your preferred Worker name). This is the name that appears in the Cloudflare dashboard and forms the default `*.workers.dev` subdomain.

3. **Build and deploy:**
   ```bash
   npm run build
   npx wrangler deploy
   ```
   The first deploy creates the Worker on Cloudflare. Output includes the live URL (`https://10xwork-find.<account>.workers.dev`).

4. **Verify logs are working:**
   ```bash
   npx wrangler tail 10xwork-find
   ```
   Open the deployed URL in a browser; confirm the request appears in the tail output with a 200 status.

5. **Set up GitHub Actions CI** (optional but recommended for auto-deploy on merge): add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets, then use the `cloudflare/wrangler-action` GitHub Action with `command: deploy` (not `pages deploy`).

---

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (GitHub Actions wiring)
- Production-scale architecture (multi-region, HA, DR)
- Cloudflare Pages configuration (removed from `@astrojs/cloudflare` v13+)
