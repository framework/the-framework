How each dashboard call learns what its host can do, and which checkout a session-scoped call should act on.

## TLDR

- One call surface, several hosts — the daemon, the per-project foreground dashboard, the public relay — and each declares per request what it wires: project scope, preview, preferences, Discord credentials, quota, the background PM, relayed sessions, in-memory event streams. Every call reads what it needs and degrades gracefully when it is absent, so a shared host never holds one user's secrets or touches files it does not own.
- A call that names a session resolves to that session's own checkout — where the session actually reads, writes, and listens — falling back to the project root only for a session that has none.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
