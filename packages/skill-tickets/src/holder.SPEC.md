Who a claim is made under, read from where the command runs — nothing for the agent to type or know.

## User story

- An agent claims a ticket and the claim names the agent, without the agent having been told any identity.
- The user sees who holds a ticket and recognises the session.

## Business logic — TL;DR

- **Inside an agent's checkout, the agent id** - the checkout's directory name under `.branches/` carries it, and keeps it for the checkout's life.
- **Anywhere else, the current branch name** - a cloud session on its own branch, a person on a feature branch.
- **A detached checkout names nobody** - there is nothing to claim as, and the caller is told so.

## Business logic

### Inside an agent's checkout, the agent id

#### User story

See `## User story`.

#### Business logic

When the command runs inside an agent's own checkout — a directory named `agent-<id>` directly under the project's `.branches/` — the holder is that agent id, taken from the directory's name.

#### Rationale

The directory keeps the id for the checkout's whole life, whereas the branch is renamed once the agent names its session: a claim naming the branch would go stale at the first rename, and the lock file it wrote would name a holder nobody can be matched to any more.

### Anywhere else, the current branch name

#### Business logic

Anywhere else the holder is the name of the branch the checkout is on: a cloud session working on its own branch, or a person on a feature branch.

### A detached checkout names nobody

#### Business logic

A checkout on no branch at all yields no identity, and the caller is told that rather than being given a made-up name.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
