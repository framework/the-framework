Turns the registered-project list into what the dashboard shows per project: its name, whether it is still set up, when it was last active, and the agent defaults its repo commits.

## Flows

- Last activity is the newest timestamp across the project's agents.
- One provider, the real registry: with one dashboard host there is no per-agent scope to substitute and no public host to blank out.
- Forgiving: a failed read shows as an inactive project with no activity, never a crash.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
