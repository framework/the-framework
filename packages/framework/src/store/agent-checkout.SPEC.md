Resolves which directory an agent id points at, and which event log a live view of that agent should follow. Every surface addressed by an agent id — the daemon's serve targets and previews, each dashboard RPC, each event stream — resolves through here, so they can never disagree about where an agent's files are.

## Business logic — TL;DR

- **An agent id resolves to its worktree, else the project root** - a live agent resolves to the checkout it reported; otherwise the worktree directory is probed directly, and only when that is gone does the project root stand in.
- **Event streams prefer an ended agent's archive over the project root** - once an agent's archive exists, its own recorded event log is what a stream follows, instead of the project root's shared one.
- **An unknown agent id is not an error** - it silently resolves to the project root.

## Business logic

### An agent id resolves to its worktree, else the project root

#### User story

The user clicks anything scoped to one agent — open its files, preview its app, act on it. That agent may be running, may have just been started a fraction of a second ago, or may already be finished and its worktree retired.

#### Business logic

Resolution tries three things in order. A running agent's own status record states the checkout it works in, so that wins. Otherwise the worktree directory for that agent id is probed on disk: it exists from the moment the daemon creates it, which is before the agent has written any status record at all. If neither holds, the project root is used.

An agent id that is unknown, malformed, or absent resolves to the project root rather than failing, because the project's own state is still the sensible thing to act on.

#### Rationale

Probing the directory matters beyond covering a slow first status write. An event stream resolves its path once, when the browser opens it, and keeps that path for the life of the connection. Falling back to the project root for an agent whose status record had not landed yet would not self-correct a moment later — the stream would follow the project root's event log for as long as the connection lived, which once made a newly started agent display a previous agent's output.

### Event streams prefer an ended agent's archive over the project root

#### User story

The user opens a finished agent and expects to read back exactly what that agent did, not whatever the project root happens to hold now.

#### Business logic

A stream scoped to an agent follows the same order — the live agent's checkout, then the worktree directory — but where plain resolution would fall back to the project root, the agent's archived event log wins instead. The archive existing proves the agent ended, and the archive is that agent's own record, whereas the project root's event log belongs to whichever root-level agent wrote it last.

The project root's event log remains the last fallback, for an agent that has neither worktree nor archive: a root-level agent that has only just started still streams correctly.

This archive preference applies to event streams only. Every other agent-addressed surface keeps the plain project-root fallback.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
