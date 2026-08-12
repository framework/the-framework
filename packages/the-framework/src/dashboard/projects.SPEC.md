Turns the registered-project list into what the dashboard shows per project: its name, whether it is still set up, when it was last active, and the run defaults its repo commits to.

## TLDR

- Last activity is the newest of the project's log entries and its runs, so a session that stopped before writing the log still counts as activity.
- Three interchangeable providers: the real registry for the daemon, a single fixed project for a one-off foreground dashboard (which never pollutes the registry), and an empty one for the public relay so registry-backed reads return nothing there.
- Forgiving: a failed read shows as an inactive project with no activity, never a crash.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
