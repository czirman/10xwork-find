---
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
---

## Why this stack

A solo developer building a personal job-search tool for a 3-week after-hours sprint needs a battle-tested, agent-friendly JavaScript starter that ships with TypeScript, Tailwind, and a fast edge deploy from day one. The `10x-astro-starter` is the recommended default for `(web-app, js)` and clears all four agent-friendly gates: typed (TypeScript + Zod schemas at boundaries), convention-based (opinionated Astro project layout), popular in training data, and well-documented. The PRD's hard "data stays local" NFR means the bundled Supabase layer will be left unused — a deliberate choice, not a gap; the starter scaffolds cleanly without requiring a Supabase account, and all user data lives in the browser. All five technology-forcing features (auth, payments, realtime, AI, background jobs) are absent from the PRD, consistent with a pure frontend skill-mapping tool. Cloudflare Pages is the starter's native deployment target; GitHub Actions with auto-deploy-on-merge is the recommended CI flow for a solo project of this scale. Bootstrapper confidence is `first-class` — scaffolding is expected to be mostly smooth with occasional manual steps.
