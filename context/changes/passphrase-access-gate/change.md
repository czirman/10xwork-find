---
change_id: passphrase-access-gate
title: Passphrase access gate
status: impl_reviewed
created: 2026-06-09
updated: 2026-06-13
roadmap_ref: S-03
---

## Notes

Roadmap slice S-03 (roadmap v2). Traces to PRD v2 FR-009 + Access Control.
Goal: gate the publicly-deployed app behind a single shared passphrase, checked
at the edge (Astro middleware on Cloudflare Workers), no server-side user records,
"data stays local" preserved.

Design steer from the user: ultra-KISS, rock-solid, standard Astro middleware,
signed-like session cookie checked against an env var, 30-day auto-expiry, no
complex crypto.
