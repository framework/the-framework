Decides whether a run's "Open session" link is worth offering: `describeSessionLink(session)` returns `{href, label}` only when the URL genuinely encodes the session id, else null.

## Decisions

- The guard is `href.includes(id)`: a headless Claude Code run defaults to the generic `claude.ai/code` entry, which opens the product page, not the session — a dead end not worth an action (the id is still visible in the event log). A real per-session deep link comes from the user's `--session-link "…/{sessionId}"` template.
- `SessionLike` is kept structural (own `sessionLink?`/`sessionId?` shape) so it never couples to the framework's exact `sessionInfo()` type.
