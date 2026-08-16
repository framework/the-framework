Turns the registered-project list into what the dashboard shows per project: its name, whether it is still set up, when it was last active, and the agent defaults its repo commits.

## TLDR

- Last activity is the newest of the project's log entries and its agents, so an agent that stopped before writing the log still counts as activity.
- One provider, the real registry: with one dashboard host there is no per-agent scope to substitute and no public host to blank out.
- Forgiving: a failed read shows as an inactive project with no activity, never a crash.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
