The device side of the relay: what another daemon is allowed to ask this daemon to do about an agent running here.

## Business logic — TL;DR

- **A fixed list of calls, nothing else** - only agent-scoped reads and steering actions may arrive over the relay; starting an agent, previewing and deleting are deliberately not on it, and an unrecognised name is refused.
- **A relayed call can only ever address this device's own project** - the calling daemon's project id is discarded and replaced with this device's own, so no relayed call can reach another project registered here.

## Business logic

### A fixed list of calls, nothing else

#### User story

The user starts an agent on another device from their dashboard, then reads its files, its diffs, its git status and its handoff, and steers it — Stop, chat, choice picks, handoff level, Merge — as if it were local.

#### Business logic

The calls a relay caller may make are exactly the agent-scoped reads and steering actions the dashboard already offers its own browser: listing and reading the agent's files, its per-file statuses, one file's diff or content, what it changed, its git status, where it is working, its handoff, its recorded events; and stopping it, messaging it, answering its gate, changing its handoff level, pushing its branch, opening its pull request and merging it. Any other name is refused, including the names every object carries by inheritance.

### A relayed call can only ever address this device's own project

#### User story

A device may have several projects registered. A daemon relaying an agent to it must not be able to reach any of them but the one it was given.

#### Business logic

The project id the calling daemon sends is meaningless on this device and is replaced with this device's own home project — the one registered when the daemon started. Every other argument, including the agent id and any file path, carries through unchanged and is then subject to the same checks a local call from this device's own browser would face.

Relayed calls never forward anything onward: on this device the named agent is local, so forwarding it again would loop.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
