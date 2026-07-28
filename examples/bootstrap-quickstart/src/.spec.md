Source of the bootstrap capstone: the full ai-autopilot epic offline, its live (real model) twin, their CLI entries, and the smoke test.

## TLDR

- `bootstrap.ts` — offline capstone: preset → Bootstrap (scope → build → loop → deploy via real `cloudflareTarget` over simulated wrangler) → scale mode; exports `INTENT`, `runCapstone`, `formatBootstrapEvent`.
- `live.ts` — the same flow with a real Anthropic model + `LocalRunner` on disk (#124); real Cloudflare deploy when a token is set, else plan-only.
- `main.ts` / `main-live.ts` — CLI entries printing each phase (offline / live).
- `bootstrap.test.ts` — node:test smoke over the offline run.
