Turns the registered-project list into what the dashboard shows per project: its name, whether it is still set up, when it was last active, and the agent defaults its repo commits (`the-framework.yml`).

## User Stories

- The user sees each registered project with its name, whether it is still set up, and when it was last active.
- The user sees the defaults an agent in a repo will run under; an edit to the repo's committed config shows up without a restart.

## Flows

- Last activity is the newest timestamp across the project's agents.
- One provider, backed by the real registry, serves every read: a project id resolves to its registered path before the per-project read runs.
- The repo's committed defaults are read fresh on every summary, which is what keeps the launcher current after an edit.
- Forgiving: a failed read shows as an inactive project with no activity, never a crash.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
