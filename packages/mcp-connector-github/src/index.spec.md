The GitHub connector definition (default export): nine tools for reading and acting on issues, pull requests, and repo files over the GitHub REST API.

## TLDR

- `defineConnector({ id: 'github', auth: { type: 'pat', env: 'GITHUB_TOKEN' }, ... })` — mounted tool names are `github_<tool>`.
- Read tools (annotated `readOnly` + `openWorld`): `get-repo`, `list-issues`, `get-issue`, `list-pull-requests`, `get-pull-request`, `get-file`, `search-issues`.
- Write tools (`openWorld` only, deliberately not `readOnly`): `comment-on-issue`, `create-issue`.
- All responses are slimmed via `slimIssue`/`slimPull` (or inline picks) to agent-relevant fields — no raw API envelopes, to keep token usage down.
- Re-exports `GitHubError` from `./client.js`.

## Decisions

- Declared as `pat` auth but an OAuth bearer works identically; the orchestrator supplies whichever via the mount `credentials` seam — the connector never does an OAuth handshake.
- `get-file` on a directory returns `McpResponse.error(...)` (→ `isError: true`) rather than success data, so agents can detect failure via the MCP flag (changeset `e8d730f`).
- `limit` inputs map to `per_page` (default 30, search default 20, schema max 100); `state` defaults to `'open'`.

## Facts

- GitHub's `/issues` endpoint returns PRs too; `list-issues` filters them out client-side via the `pull_request` field, and `slimIssue` exposes `isPullRequest` for search results.
- `get-file`: the contents API returns an *array* for a directory path (the error case), and file `content` is base64-decoded to utf8 when `encoding === 'base64'`.
- All user-supplied path segments are `encodeURIComponent`-encoded; `get-file` splits `path` on `/` and encodes each segment so slashes survive.
- `search-issues` uses `/search/issues` with GitHub search syntax and returns `{ totalCount, items }`.
