The process-tree kill registry: every agent child is spawned as its own process-group leader and the whole group is signalled at once, so an interrupted run cannot orphan a subtree.

## Problems

- Signalling only the top-level agent process orphans its subtree (node workers, ripgrep, bash tool calls, MCP servers), which reparents to init and keeps burning CPU — the observed swarm-of-stray-agents leak.
- A CLI that exits before reading stdin raises an async EPIPE on the stream; with no listener that is an uncaught exception in the daemon — a no-op error handler is installed.

## Decisions

- Children are spawned `detached` and signalled via negative pid, reaping the whole tree at once; killing an already-exited group is not an error.
- Termination ladder: SIGTERM → a short grace → SIGKILL. A lazily installed `process.on('exit')` hook SIGKILLs every still-registered group on *any* exit path — it must be synchronous, hence plain SIGKILL; signal deaths are handled by the CLI (which aborts the run first), this hook is the last-resort net.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
