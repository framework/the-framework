Minimal GitHub REST client (`gh()`) over global `fetch`, plus the `GitHubError` class — no GitHub SDK dependency so the connector stays light.

## TLDR

- `gh(ctx, method, path, body?)` calls `https://api.github.com${path}` with `Authorization: Bearer <ctx.auth.token>` (a PAT or OAuth bearer — GitHub accepts either), `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`, `User-Agent: gemstack-connector-github`; JSON body when provided.
- Missing token → `GitHubError(401)` with an actionable message (set `GITHUB_TOKEN` or pass mount `credentials`).
- Non-2xx → `GitHubError(status, "<METHOD> <path> -> <status> <statusText>: <body text>")`; `204` → `undefined`; otherwise parsed JSON.

## Facts

- A `fetch()` transport failure (DNS, timeout, offline) is rethrown as `GitHubError` with `status: 0` instead of a raw `TypeError` (changeset `eaa667c`), so all failures surface through one typed class.
