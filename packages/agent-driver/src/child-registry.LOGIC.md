Keeps the coding agent's [1] whole process tree reapable: every coding agent process a driver [2] spawns is the leader of its own process group and is registered here while it lives, so a stop reaches the whole tree with one signal, and a hard exit of The Framework's own process still kills every tree on the way out.

## Context

**User story**: the user stops an agent [3], or The Framework's process dies from a crash, and no stray coding agent [1] processes are left burning CPU on the machine.

**Problem**: a coding agent spawns a deep subtree of its own: worker processes, search tools, the shell commands it runs, MCP servers. Signaling only the top process orphans that subtree, which keeps running on its own after the agent is gone.

## Glossary

[1] coding agent: the CLI doing the actual work: Claude Code or Codex.
[2] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] stop request: the caller's signal that a driver session, or one turn of it, must end now; the product raises one when the user stops the agent.
[5] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.

## Business logic — TL;DR

- **One signal for the whole tree** - a process group is signaled as a whole through its leader, so the coding agent [1] and everything it spawned go down together; a group that has already exited is not an error.
- **Every live leader is registered** - a driver [2] registers each process-group leader it spawns and removes it once the process is gone.
- **A hard exit reaps everything** - when The Framework's process exits for any reason other than a signal, every registered group is force-killed on the way out; a death by signal is the caller's to handle by raising the stop request [4] of each driver session [5] first.

## Business logic

### One signal for the whole tree

#### Context

See `## Context`.

#### Business logic

A coding agent [1] process is spawned as the leader of its own process group. Signaling the group, rather than the leader alone, reaches the coding agent and every process it spawned in one shot. Signaling a group that has already exited, or a process that never led one, is silently ignored: it is not an error.

### Every live leader is registered

#### Context

See `## Context`.

#### Business logic

A driver [2] registers the process-group leader it spawns for a turn as soon as it has a process id, and removes it once the process has exited or been killed. The registry holds only live groups, so a reap on exit never signals a process id that may since have been reused by something else.

### A hard exit reaps everything

#### Context

**Problem**: The Framework's process may end without any driver [2] getting the chance to end its turn: a crash, an uncaught error, a deliberate exit. Whatever coding agent [1] trees are alive at that moment must not survive it.

#### Business logic

When The Framework's process exits, whether normally, deliberately, or after an uncaught error, every registered process group is force-killed on the way out. Only a forced kill is possible at that point, since nothing may wait during an exit. A death by signal, such as the user's Ctrl-C or a termination request from the system, does not pass through this net: it is the caller's to handle, by raising the stop request [4] of each driver session [5] first, which ends each turn gracefully (`cli-session.ts`). The net is installed the first time a process is registered and is the last resort for every other exit path.
