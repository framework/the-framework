The process behind the dashboard: it serves the UI, spawns agents, and runs the background services.

## Flows

- It runs in the foreground and only in the foreground. Ctrl-C closes the dashboard and every agent it is running, so there is no liveness record, no machine-global state file, and no second process to find, reuse or stop.
- The dashboard is a projection of each project's on-disk event log, and steering flows back through an append-only control file — files are the seam, never a direct agent-to-dashboard connection.
- Bound to localhost by default; binding to the network requires a generated shared token.
- At boot it registers the home project, marks agents a dead process left "running" as stopped, and starts the background services; it resumes nothing. Every other project joins through the dashboard's "Add project" — the one onboarding path, so a repo is always installed before an agent can touch it.
- Shutdown is ordered: background services quiesce first, live agents are stopped, their archives committed, then the dashboard goes. Each step is waited out rather than merely started, so the archives being committed are the finished ones — the sweeps are off the repo before the agents are torn down, and the teardowns are done before their work is committed.

## Rationales

- Foreground-only is a deliberate trade: unattended work needs a window left open, the way any dev server does. The product's promise of spending idle quota while nobody is at the keyboard holds with that window open — and the spending is visible and killable rather than invisible and persistent, the right direction for a tool that spends a subscription: nothing burns quota after you have closed it.
- Binding to the network requires the token because a process that spawns agents would otherwise be remote code execution for whoever finds the port.
- Boot resumes nothing because the Ctrl-C that closed those agents was deliberate.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
