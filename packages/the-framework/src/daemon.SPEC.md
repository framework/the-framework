The machine's one persistent background process: it serves the dashboard, spawns and tracks runs, and outlives any single run.

## TLDR

- One daemon per machine, recorded in a single global state file so a later invocation from any repo finds it, starts one if none is running, or stops it; a heartbeat rewrites the record if something deletes it, while yielding to another live daemon.
- The dashboard is a projection of each project's on-disk event log, and steering flows back through an append-only control file — files are the seam, never a direct run-to-daemon connection.
- Bound to localhost by default; binding to the network requires a generated shared token, because a process that spawns agents would otherwise be remote code execution for whoever finds the port.
- At boot it registers the home project (and, when opted in, every repo in the user's repos directory), marks runs a dead daemon left "running" as stopped, resumes what the previous daemon suspended, and starts the background services.
- Shutdown is ordered: background services quiesce first, live runs are suspended for resume, their conversations committed, then the dashboard and the state file go.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
