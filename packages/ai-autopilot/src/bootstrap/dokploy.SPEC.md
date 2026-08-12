The Dokploy deploy adapter: it triggers a deployment of a pre-configured application on a self-hosted Dokploy server.

## TLDR

- Dokploy builds and serves the app itself from its own configured source, so this adapter only triggers the deployment (or a full rebuild) — unlike the Cloudflare adapter, it builds and uploads nothing.
- It never throws: missing credentials or settings, a rejected request, or a network failure come back as a not-deployed outcome with the reason.
- Success reports the triggered deployment, not a URL — the app's address lives in the Dokploy configuration.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
