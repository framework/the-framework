The skill's instructions: what an agent is told about the project's agent queue — where it lives, how to read and change it, and the format it is written in.

## User story

- The user expects agents to pick up work from one queue, to add follow-up work to it, and to take an entry off once its work is done — without the user having to put any of that in a prompt.

## Business logic — TL;DR

- **The queue is on a branch, not in your checkout** - `TODO_AGENTS.md` lives on the `agent-data` branch, never on a code branch; the agent's own checkout does not contain it. It lists every task agents will work on next, in the order they will be taken.
- **The `queue` command is the only way to change it** - it ships with the `@gemstack/skill-queue` package the repository depends on: the agent installs the repository's dependencies once, when there is no `node_modules` yet, and runs `npx queue`, so every command the skill names runs as written on a fresh clone. Every change it makes is one commit pushed straight to the `agent-data` branch; a refusal exits 1 with a line on stderr, a wrong command line exits 2 with the usage.
- **Read: the bare command** - the open entries in order of work, as one JSON array.
- **Change: `add`, `done`** - put an entry on the queue, placed in its `## Priority N` section by a 0–10 priority, at the end of the file without one; take an entry off, by its text as listed, which deletes it.
- **The format** - `## Priority N` sections from 10, critical and to be acted on immediately, down to 0, only if capacity; an entry is a list item, a link or a self-contained description; first within a band first to be taken; a done entry is removed, never ticked off.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
