Reads the plan and backlog documents the dashboard surfaces in its sidebar, so the human can read them beside the agent. Two categories, in sidebar order: plans — the workspace-root `PLAN.md`, then the per-session `PLAN_<session name>.agent.md` files (sorted) — and backlogs — the agent queue (`TODO_AGENTS.md`, read off the `agent-data` branch, its one location; a leftover copy in the workspace root never shadows it), then the per-session `TODO_<session name>.agent.md` files (sorted). The per-session files are the plan and backlog The Framework's system prompt has each agent write.

Missing and blank documents are skipped; a document over a size cap is truncated with a visible marker; the read never throws — a missing or unreadable workspace surfaces nothing. Every surfaced name is a bare directory-listing entry matched against a fixed pattern (the session-name part admits only `a-z0-9-`), never taken from user input, so no name can traverse out of the workspace.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
