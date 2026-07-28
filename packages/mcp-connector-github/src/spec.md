Source of the GitHub connector: definition + REST client + tests.

## TLDR

- `index.ts` — the `defineConnector` default export: 9 `github_*` tools (7 read-only, 2 write) with slimmed responses; re-exports `GitHubError`.
- `client.ts` — `gh()` fetch wrapper (Bearer auth, GitHub API headers, typed `GitHubError` incl. `status: 0` for transport failures).
- `index.test.ts` — mounted end-to-end suite over a fetch stub.
