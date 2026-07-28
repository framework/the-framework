Runnable example packages — one per major monorepo package — each a private `@gemstack/example-*` workspace package with a `start` script and an offline node:test smoke suite.

## TLDR

- `autopilot-quickstart/` — the four `ai-autopilot` layers (workers → Supervisor → runner → surfaces) composed into one build-a-feature flow.
- `bootstrap-quickstart/` — the capstone: preset detection + Bootstrap (scope → build → full-fledged loop → deploy) + scale mode; includes a live variant against a real model (#124).
- `connectors-quickstart/` — a reference read-only MCP connector, written to be copied for real ones.
- `framework-demo/` — one prompt through the real `runFramework` (fake driver) ending at an actually-serving app + simulated Cloudflare deploy; the demo to show people.
- `mcp-quickstart/` — a framework-neutral, OAuth 2.1-protected `@gemstack/mcp` server on raw `node:http` and Hono.

## Facts

- All examples run offline and deterministically by default: `AiFake` scripts models, `FakeRunner` is an in-memory sandbox, the framework demo uses the fake driver, and Cloudflare deploys run the real `cloudflareTarget` adapter over a simulated wrangler.
- Shared package layout: `start*` scripts run `tsx src/...`; `test` compiles via `tsconfig.test.json` into `dist-test` and runs `node --test` there.
