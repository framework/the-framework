Source of the framework demo: the one-prompt-to-running-app flow, its CLI entry, and the smoke test.

## TLDR

- `demo.ts` — drives the real `runFramework` with the fake driver to a genuinely-serving local app + simulated Cloudflare deploy; exports `DEMO_INTENT`, `runDemo`.
- `main.ts` — CLI entry printing narration + outcome.
- `demo.test.ts` — node:test smoke asserting the full offline flow including the real fetch of the served app.
