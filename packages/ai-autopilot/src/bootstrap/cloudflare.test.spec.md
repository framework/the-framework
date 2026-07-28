Tests for `cloudflare.ts` — covers Workers vs Pages routing, credential handling, and failure reporting via a fake `DeployExecutor` that returns canned results by command substring.

## TLDR

- SSR → `npx wrangler deploy` with the workers.dev URL; SSG → `wrangler pages deploy dist/client --project-name …` with the pages.dev URL.
- Credentials reach only the wrangler call's env, never install/build; token falls back to `CLOUDFLARE_API_TOKEN` in the environment.
- Short-circuits: missing token runs zero commands; Pages without `projectName` never runs wrangler; a failed build skips wrangler and surfaces its stderr.
- `installCommand`/`buildCommand: false` skip straight to wrangler; `product: 'pages'` overrides an SSR plan; deploy with no URL in output still reports `deployed: true`.

## Facts

- Tests that mutate `process.env.CLOUDFLARE_API_TOKEN` save/restore it, so the suite is order-independent.
