The process behind the dashboard: it serves the UI, spawns agents, and runs the background services.

## TLDR

- It runs in the foreground and only in the foreground. Ctrl-C closes the dashboard and every agent it is running, so there is no liveness record, no machine-global state file, and no second process to find, reuse or stop.
- The trade that buys: unattended work needs a window left open, the way any dev server does. The product's promise is spending idle quota while nobody is at the keyboard, and that still holds — but it is now visible and killable rather than invisible and persistent, which is the right direction for a tool that spends a subscription: nothing burns quota after you have closed it.
- The dashboard is a projection of each project's on-disk event log, and steering flows back through an append-only control file — files are the seam, never a direct agent-to-dashboard connection.
- Bound to localhost by default; binding to the network requires a generated shared token, because a process that spawns agents would otherwise be remote code execution for whoever finds the port.
- At boot it registers the home project (and, when opted in, every repo in the user's repos directory), marks agents a dead process left "running" as stopped, and starts the background services. It resumes nothing: Ctrl-C was deliberate.
- Its very first act is to read the settings block a retired tier left in the user's home file, because its own next writes rewrite that file without it. What it finds is printed and handed to the dashboard; nothing about it is honoured.
- Shutdown is ordered: background services quiesce first, live agents are stopped, their archives committed, then the dashboard goes. Each step is waited out rather than merely started, so the archives being committed are the finished ones — the sweeps are off the repo before the agents are torn down, and the teardowns are done before their work is committed.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
