Daemon lifecycle: one daemon per machine, its liveness in a single global state file, and the boot/shutdown ordering.

## TLDR

- Liveness lives in one JSON state file next to the registry, so `framework` in any repo finds the same daemon. A heartbeat re-asserts the file, so anything that deletes it heals within a tick.
- Boot order: shared token (only for a non-loopback bind) → ensure `.the-framework/` → register the home project → scan the repos directory → reconcile orphaned runs → per-project runtime → serve the dashboard → state file + heartbeat → resume suspended runs → background services.

## Decisions

- A non-loopback bind **demands** the shared token: a daemon that spawns processes on a reachable port is remote code execution. The browser bridge reuses this same secret rather than minting a second.
- Shutdown order is fixed: quiesce services → suspend runs → flush conversations → stop quota → dispose previews → close dashboard → stop heartbeat → remove the state file. Quiescing first stops auto-PM/Discord from starting a run mid-shutdown; the heartbeat must stop *before* file removal or it writes the record back.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
