The process behind the dashboard: it serves the UI, spawns sessions, and runs the background services.

## TLDR

- It runs in the foreground and only in the foreground. Ctrl-C closes the dashboard and every session it is running, so there is no liveness record, no machine-global state file, and no second process to find, reuse or stop.
- The dashboard is a projection of each project's on-disk event log, and steering flows back through an append-only control file — files are the seam, never a direct session-to-dashboard connection.
- Bound to localhost by default; binding to the network requires a generated shared token, because a process that spawns agents would otherwise be remote code execution for whoever finds the port.
- At boot it registers the home project (and, when opted in, every repo in the user's repos directory), marks sessions a dead process left "running" as stopped, and starts the background services. It resumes nothing: Ctrl-C was deliberate.
- Shutdown is ordered: background services quiesce first, live sessions are stopped, their archives committed, then the dashboard goes. Each step is waited out rather than merely started, so the archives being committed are the finished ones — the sweeps are off the repo before the sessions are torn down, and the teardowns are done before their work is committed.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
