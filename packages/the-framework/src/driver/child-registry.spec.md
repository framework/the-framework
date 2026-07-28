Process-tree kill registry: signal a whole detached process group and force-kill every tracked child when the framework process exits.

## TLDR

- `killTree(pid, signal)` signals the group via negative pid (child must be a `detached` group leader); never throws — an already-gone group is not an error.
- `registerChild` / `unregisterChild` track live group leaders; a lazily-installed `process.on('exit')` hook SIGKILLs every remaining group.

## Problems

- Signaling only the top-level `claude` orphans its subtree (node workers, ripgrep, bash tools, MCP servers), which reparents to init and keeps burning CPU — the runaway-process leak after interrupted runs this module exists to fix.

## Facts

- The `exit` hook is sync-only, so a plain group SIGKILL is all it can do; it is the last-resort net for crash/`process.exit` paths — SIGINT/SIGTERM deaths are handled by the CLI aborting the run first.
