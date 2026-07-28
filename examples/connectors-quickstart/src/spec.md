Source of the connectors quickstart: a copyable reference connector, a runnable mount-and-call demo, and its smoke test.

## TLDR

- `library-connector.ts` — the reference read-only connector (`defineConnector`, 3 tools, `auth: none`); the file to copy for a real connector.
- `demo.ts` — mounts it with `mountConnectors` (credentials seam wired) and drives it through `McpTestClient`.
- `connector.test.ts` — node:test smoke: namespacing, search, get-by-id.
