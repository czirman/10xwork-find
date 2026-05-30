# Deploy 10xwork-find to Cloudflare Workers

> Approved Plan Mode artifact — audit trail of "what was supposed to happen" for the first production deploy.
> Source platform decision: `context/foundation/infrastructure.md`. Stack constraints: `context/foundation/tech-stack.md`.

## Context

The project is already scaffolded for Cloudflare Workers (`@astrojs/cloudflare` v13.5.0, `wrangler.jsonc` with the Workers entrypoint, `nodejs_compat` flag, `assets.directory: "./dist"`). What was missing at plan time: the Worker name was still the starter template default, the adapter version was unpinned (risk: breaking patch bumps), the CI workflow had no deploy step, and Cloudflare credentials had not been set up. This plan wires all of that up end-to-end.

---

## Phase 1 — Code Changes (automated) ✅ applied

| File | Change | Status |
| --- | --- | --- |
| `wrangler.jsonc` | `name`: `"10x-astro-starter"` → `"10xwork-find"` | ✅ done |
| `package.json` | Pin `@astrojs/cloudflare` to `"13.5.0"` (remove `^`) | ✅ done |
| `.github/workflows/ci.yml` | Add `deploy` job (push-to-main only, after `ci`) | ✅ done |
| `.dev.vars` | Create empty file (gitignored) | ✅ done |

**1. `wrangler.jsonc` — Worker name.** The `name` is what appears in the Cloudflare dashboard and forms the `.workers.dev` subdomain.

**2. `package.json` — pin adapter.** Patch versions in v13 have included breaking changes (config key removals, env access changes); pinning prevents silent CI breakage from Dependabot bumps.

**3. `.github/workflows/ci.yml` — deploy job.** Runs only on push to `main` (not PRs), and only if `ci` passes (`needs: ci`). Rebuilds the app (no Supabase secrets needed — they are `optional: true` in `astro.config.mjs`), then deploys via `cloudflare/wrangler-action@v3`:

```yaml
deploy:
  needs: ci
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: npm
    - run: npm ci
    - run: npm run build
    - uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        command: deploy
```

> **Edge case — `SUPABASE_URL`/`SUPABASE_KEY` in the existing CI build step:** the `ci` job passes these secrets to its build. Since both are `optional: true` in `astro.config.mjs`, the new `deploy` job's build step intentionally omits them. The `ci` job's `env` block is left as-is (empty strings from undefined secrets do not break the build).

**4. `.dev.vars` — local secrets file (gitignored).** The correct file for local Cloudflare Workers secrets (equivalent to `.env`); `astro dev` runs the workerd runtime and looks for it. The app needs no secrets for core functionality, so the file starts empty.

```
# Local Cloudflare Workers secrets — gitignored
# EXAMPLE_SECRET=value
```

---

## Phase 2 — Manual Authentication Gates

Human action required; cannot be automated. Must be completed before Phase 3.

**Gate A — Authenticate Wrangler locally**

```
! npx wrangler login
```

Opens a browser OAuth flow. Required for the first manual deploy in Phase 3.
*Status: already authenticated as `service.mak@proton.me` (account `14e0d56c656d00a1236017a85f01812b`).*

**Gate B — Create a Cloudflare API Token**

1. Cloudflare dashboard → My Profile → API Tokens → Create Token
2. Use template "Edit Cloudflare Workers", scope to your account
3. Copy the token — it is shown only once
4. Find your Account ID: Cloudflare dashboard → right sidebar on any Workers/Pages page, under "Account ID"

**Gate C — Add GitHub repository secrets**

GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
- `CLOUDFLARE_API_TOKEN` — the token from Gate B
- `CLOUDFLARE_ACCOUNT_ID` — the Account ID from Gate B (`14e0d56c656d00a1236017a85f01812b`)

**Gate D — Verify the Cloudflare account email** ⚠️ discovered during first deploy attempt

The Cloudflare API rejects Worker script uploads with `[code: 10034]` until the account email is verified, even though auth, build, asset upload, and KV provisioning all succeed first. One-time action: click the verification link sent to `service.mak@proton.me`, or trigger a resend via the dashboard banner / https://developers.cloudflare.com/fundamentals/setup/account/verify-email-address/. Re-run `npx wrangler deploy` after verifying.

---

## Phase 3 — First Manual Deploy (Verification) ✅ deployed 2026-05-28

**Live URL:** https://10xwork-find.service-mak.workers.dev — verified HTTP 200.
**Version ID:** `452ac73a-d6ce-4a6f-bee7-93a8ae9580a6`. **SESSION KV:** `9f37fdb86938437ca007853a3a143058`.

> **Config fix applied during deploy:** the Astro adapter generates a `SESSION` KV binding with no `id`, so wrangler's auto-provisioner tried to create the namespace on every run and failed with `[code: 10014]` once it already existed. Fixed by declaring the binding with the existing namespace ID in `wrangler.jsonc` (`kv_namespaces`), which the build merges into `dist/server/wrangler.json`. CI deploys reuse this same config — no per-run provisioning.

Run locally after completing Gates A–C:

```bash
# 1. Dry-run to validate wrangler config before touching production
npx wrangler deploy --dry-run

# 2. Build
npm run build

# 3. Deploy
npx wrangler deploy
```

Expected output: `Deployed 10xwork-find ... https://10xwork-find.<account>.workers.dev`

Tail logs to confirm the Worker is alive:

```bash
npx wrangler tail 10xwork-find
```

Open the live URL in a browser — the request should appear in the tail with HTTP 200.

> **Edge case — Worker name collision:** if a Worker named `10xwork-find` already exists on the account under a different project, `wrangler deploy` overwrites it silently. List existing Workers first: `npx wrangler deployments list` or check the dashboard.

> **Edge case — CPU limit on free tier:** if synonym matching is CPU-intensive, the free tier's 10ms per-invocation cap may be hit on production PoPs. Symptom: `1101 Exceeded CPU limit` (not a 500). Mitigation: upgrade to Workers Standard ($5/mo) via the dashboard.

---

## Phase 4 — CI Auto-Deploy Verification

After merging a commit to `main`:

1. Confirm the `deploy` job appears in GitHub Actions (after `ci` passes)
2. Confirm the Cloudflare dashboard shows a new deployment under `10xwork-find`
3. Confirm the live URL serves the updated build

> **Edge case — first CI deploy without `.dev.vars`:** `.dev.vars` is gitignored and only needed locally. CI does not need it; the deploy build step has no secrets to pass.

> **Edge case — `wrangler pages deploy` in old CI templates:** if a future GitHub Actions template uses `wrangler pages deploy`, it will fail (Pages SSR was removed in `@astrojs/cloudflare` v13). The correct command is always `wrangler deploy` (Workers path).

---

## Verification Checklist

- [ ] `npx wrangler deploy --dry-run` exits 0 with no errors
- [ ] `npx wrangler deploy` outputs a live `*.workers.dev` URL
- [ ] `wrangler tail` shows an HTTP 200 on first visit
- [ ] GitHub Actions `deploy` job runs green on next push to `main`
- [ ] Cloudflare dashboard shows `10xwork-find` Worker with correct deployment timestamp
