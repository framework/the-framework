Collects the agent queue [1] of every project into the dashboard's cross-project queue: one block per project that has a queue, with its open entries [2] in order of work, the project with the most entries first. Each project's queue is read through the queue provider [3] one of its packages declares (`../store/queue.ts`); this file knows no queue file and no queue package.

## Context

**User story**: with no project selected, the user sees on the Overview what agents will work on next in every project, and which project has the most waiting; a ticket the queue links to shows in the hot tickets' AI Queue lane; the tickets page's "add to queue" skips what is already queued. A project without a queue package appears in none of it.

## Glossary

[1] the agent queue: every task agents will work next, in the order they will be taken, kept by a project package (the `queue` skill keeps it as `TODO_AGENTS.md` on the `agent-data` branch, in priority sections).
[2] entry: one task on the agent queue [1], as the provider's command prints it: the text a future agent is started with.
[3] queue provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's agent queue [1], in its own package.json under `"framework": { "queue": "<command>" }`.

## Business logic — TL;DR

- **One block per project that has a queue, most entries first** - a project whose package provides a queue is listed even when nothing is queued; a project with no provider is left out; a provider that cannot be looked up is left out and one whose read fails lists no entries; the blocks are ordered by their number of entries, descending.

## Business logic

### One block per project that has a queue, most entries first

#### Context

See `## Context`.

#### Business logic

For each project, its queue provider [3] is looked up. A project with no provider has no queue and contributes no block: the dashboard says nothing about a queue the project does not keep. A project with a provider contributes a block even when its queue is empty, so the Overview's card can name the projects it speaks for. The block carries the project's id and name and its open entries [2], in the order the provider prints them, which is the order of work. A provider lookup that fails is treated as no provider; a read that fails gives a block with no entries. The blocks are ordered by their number of entries, highest first.
