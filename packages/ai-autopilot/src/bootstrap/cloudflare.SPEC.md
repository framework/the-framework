The Cloudflare deploy adapter: it ships the freshly built app live on Cloudflare and reports the resulting URL.

## TLDR

- Works inside the same workspace the app was built in: install, build, then deploy.
- Server-rendered apps go to Cloudflare Workers (they need a server); prebuilt and client-only apps go to Cloudflare Pages.
- It never throws: missing credentials, a failed build, or a failed deploy come back as a not-deployed outcome with the reason, so the flow narrates the failure instead of crashing an app that was already built.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
