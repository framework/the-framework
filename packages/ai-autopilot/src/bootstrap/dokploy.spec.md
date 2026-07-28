A real `DeployTarget` that triggers a deployment of a pre-configured application on a self-hosted Dokploy instance over its HTTP API.

## TLDR

- `dokployTarget({ serverUrl, applicationId, … })` returns a `DeployTarget` (name default `'dokploy'`) whose `deploy()` POSTs to `<base>/api/application.deploy` (or `application.redeploy` when `redeploy: true`).
- Unlike `cloudflareTarget`, it does not build/upload from the session: Dokploy builds server-side from its own configured git source, so this target only triggers.
- `fetch` is injectable (`FetchLike`) for tests; defaults to global `fetch`; forwards `ctx.signal` when present.

## Decisions

- Never throws: missing token/serverUrl/applicationId, non-2xx responses (status + first 300 body chars), and network rejections all come back as `{ deployed: false, detail }`.
- A successful result reports the *triggered* deployment, not a URL — the Dokploy deploy trigger does not return the app's public URL (the domain is configured on the Dokploy side).

## Facts

- Auth header is `x-api-key`; token fallback chain: `apiToken` ?? `DOKPLOY_AUTH_TOKEN` ?? `DOKPLOY_API_KEY` (read at deploy time).
- `apiBase()` normalizes `serverUrl` to `<origin>/api`, tolerating a trailing slash and/or an already-included `/api`.
- Request body: `{ applicationId, title: 'GemStack bootstrap deploy', description: ctx.plan.reason }`.
