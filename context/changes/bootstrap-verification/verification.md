---
bootstrapped_at: 2026-05-27T17:42:00Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: 10xwork-find
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: 10xwork-find
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: false
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

## Why this stack

A solo developer building a personal job-search tool for a 3-week after-hours sprint needs a battle-tested, agent-friendly JavaScript starter that ships with TypeScript, Tailwind, and a fast edge deploy from day one. The `10x-astro-starter` is the recommended default for `(web-app, js)` and clears all four agent-friendly gates: typed (TypeScript + Zod schemas at boundaries), convention-based (opinionated Astro project layout), popular in training data, and well-documented. The PRD's hard "data stays local" NFR means the bundled Supabase layer will be left unused — a deliberate choice, not a gap; the starter scaffolds cleanly without requiring a Supabase account, and all user data lives in the browser. All five technology-forcing features (auth, payments, realtime, AI, background jobs) are absent from the PRD, consistent with a pure frontend skill-mapping tool. Cloudflare Pages is the starter's native deployment target; GitHub Actions with auto-deploy-on-merge is the recommended CI flow for a solo project of this scale. Bootstrapper confidence is `first-class` — scaffolding is expected to be mostly smooth with occasional manual steps.

## Pre-scaffold verification

| Signal      | Value    | Severity | Notes                                                              |
| ----------- | -------- | -------- | ------------------------------------------------------------------ |
| npm package | not run  | —        | `cmd_template` starts with `git clone`; no npm package to resolve |
| GitHub repo | not run  | —        | `gh` CLI not installed; recency check unavailable                  |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone (cloned starter repo, deleted upstream `.git/` before move-up)
**Exit code**: 0
**Files moved**: 19 items (astro.config.mjs, components.json, .env.example, eslint.config.js, .github/, .gitignore, .husky/, node_modules/, .nvmrc, package.json, package-lock.json, .prettierrc.json, public/, README.md, src/, supabase/, tsconfig.json, .vscode/, wrangler.jsonc)
**Conflicts (.scaffold siblings)**: CLAUDE.md (existing cwd copy preserved; scaffold copy → CLAUDE.md.scaffold)
**.gitignore handling**: moved silently (no .gitignore existed in cwd before scaffold)
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW
**Direct vs transitive**: 0/0 CRITICAL direct/total, 0/1 HIGH direct/total (devalue is transitive), 2/9 MODERATE direct/total (wrangler, @astrojs/check are direct)

#### CRITICAL findings

None.

#### HIGH findings

- **devalue** — range 5.6.3–5.8.0
  Advisory: GHSA-77vg-94rm-hx3p — "Svelte devalue: DoS via sparse array deserialization"
  CVSS: 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)
  CWE: CWE-770 (Allocation of Resources Without Limits or Throttling)
  Dependency path: transitive (not a direct dependency)
  Fix: available (`npm audit fix`)

#### MODERATE findings

1. **@astrojs/check** (direct) — range >=0.9.3
   Via: @astrojs/language-server. Fix available (major bump to 0.9.2 required).
2. **@astrojs/language-server** (transitive) — range >=2.14.0
   Via: volar-service-yaml. Fix available (via @astrojs/check 0.9.2 major bump).
3. **@cloudflare/vite-plugin** (transitive) — range <=0.0.0-fff677e35 || 0.0.7–1.37.2
   Via: miniflare, wrangler, ws. Fix available.
4. **miniflare** (transitive) — range <=0.0.0-fff677e35 || 3.20250204.0–4.20260518.0
   Via: ws. Fix available.
5. **volar-service-yaml** (transitive) — range <=0.0.70
   Via: yaml-language-server. Fix available (via @astrojs/check 0.9.2 major bump).
6. **wrangler** (direct) — range <=0.0.0-kickoff-demo || 3.108.0–4.93.0
   Via: miniflare. Fix available.
7. **ws** (transitive) — range 8.0.0–8.20.0
   Advisory: GHSA-58qx-3vcg-4xpx — "ws: Uninitialized memory disclosure"
   CVSS: 4.4 (AV:N/AC:H/PR:H/UI:N/S:U/C:H/I:N/A:N). Fix available.
8. **yaml** (transitive) — range 2.0.0–2.8.2
   Advisory: GHSA-48c2-rrv3-qjmp — "yaml: Stack Overflow via deeply nested YAML collections"
   CVSS: 4.3. Fix available (via @astrojs/check 0.9.2 major bump).
9. **yaml-language-server** (transitive) — range 1.11.1-08d5f7b.0–1.21.1-f1f5a94.0 || 1.22.1-0ae5603.0–1.22.1-fc5f874.0
   Via: yaml. Fix available (via @astrojs/check 0.9.2 major bump).

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | false                |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | false                |
| has_background_jobs     | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review `CLAUDE.md.scaffold` — the starter ships its own CLAUDE.md; your existing one was preserved. Run `diff CLAUDE.md CLAUDE.md.scaffold` to see what the starter had.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log. Run `npm audit fix` to resolve the HIGH and most MODERATE findings automatically.
