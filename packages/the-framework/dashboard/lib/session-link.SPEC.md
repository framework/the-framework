Decides whether an agent gets an "Open session" link in the dashboard, and what it reads. The link is offered only when its URL actually contains the agent's session id — a per-session deep link the user configured with `--session-link "…/{sessionId}"` — and it is labelled with that id. Any other URL, such as the generic claude.ai/code entry, opens a product page rather than the session, so no link is shown at all; the session id itself remains visible in the event log either way.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
