How The Framework reads a project's agent queue [1]: through the queue provider [2], a command one of the project's own packages declares, never through a package The Framework knows. It also owns the shape of what that command answers: an entry [3] is one string.

## Context

**User story**:
- The user opens the Overview and sees, per project, what agents will work on next; a ticket the queue links to shows in the hot tickets' AI Queue lane; the tickets page skips a ticket that is already queued.
- A project that installed no queue package has no queue: the Overview's card says nothing about it, and the onboarding step about the queue does not apply.

**Business logic story**: The Framework names no skill. A project picks the package that keeps its queue by listing it as a dependency; that package says, in its own package.json, which of its commands answers for the queue (`"framework": { "queue": "queue" }` for the `queue` skill's package). The Framework only reads: putting something on the queue is the widget [4] that package brings, acting through its own command from the browser.

**Problem**: the dashboard reads every project's queue on several polls every few seconds, and every read of the provider is a process.

## Glossary

[1] the agent queue: every task agents will work next, in the order they will be taken, kept by a project package (the `queue` skill keeps it as `TODO_AGENTS.md` on the `agent-data` branch, in priority sections).
[2] queue provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's agent queue [1], in its own package.json under `"framework": { "queue": "<command>" }`.
[3] entry: one task on the agent queue [1], as the provider's command prints it: the text a future agent is started with. A markdown link at its start names the work and where it points; The Framework reads that in `dashboard/overview.ts` and `dashboard/lib/queue-entry.ts`.
[4] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard, offers actions on the links pages show, and reads and changes its data through its own package's command.

## Business logic — TL;DR

- **Which command provides** - the first of the project's dependencies, in its package.json's order, that declares a queue provider [2] naming one of its own commands; no dependency declares one, the project has no queue.
- **The command line it answers** - `<command> --local`: the open entries [3], in order of work, as one JSON array of strings, from the copy on this machine with no network. Nothing else: The Framework never writes the queue.
- **The shape** - the non-empty strings of the array, trimmed, in order; anything else, a failure included, reads as no entries, never an error.
- **Reads are shared for five seconds, and forgotten when a widget acts** - the same project's queue read again within five seconds reuses the answer; reads at the same moment share one call; a widget's command having run in the project forgets the read, so the next one runs the command again.

## Business logic

### Which command provides

#### Context

See `## Context`.

#### Business logic

The project's own package.json is read; its `dependencies` then `devDependencies` are taken in their order, a name listed twice read once. Each is looked up in the project's `node_modules`, links followed. The first whose own package.json declares `"framework": { "queue": "<command>" }`, where `<command>` is one of that package's own commands, is the queue provider [2]. A declaration naming a command the package does not have is skipped. No package.json, no installed dependency, or no declaration: the project has no queue provider, and the project has no queue (`undefined`, which `dashboard/queue.ts` turns into "not listed"). The provider is looked up again at most every five seconds, so a project that installs, swaps or drops its provider is read the new way within five seconds.

### The command line it answers

#### Context

**Business logic story**: the command is the same one an agent runs to read the queue; The Framework uses the one flag an agent does not.

#### Business logic

The provider's command runs with Node, in the project's root, never through a shell, for at most 30 seconds and 16 MB of output (the rules of `project-widgets.ts`). One call, `<command> --local`, prints the open entries [3] in order of work as one JSON array and exits 0; `--local` asks for the copy kept on this machine, read without contacting the remote, because The Framework polls. Anything else, an exit code, no JSON, JSON that is not an array, reads as no entries. That is the whole contract: The Framework has no call that writes the queue.

### The shape

#### Context

See `## Context`.

#### Business logic

Of the array the command prints, each string is an entry [3], trimmed; an empty string and anything that is not a string are dropped; the order is kept. The Framework reads nothing into an entry beyond its text here.

### Reads are shared for five seconds, and forgotten when a widget acts

#### Context

**Problem**: see `## Context`. And a widget's "Add to queue" writes through the widget's own command, which The Framework does not see; a read cached a moment before would show the queue without the new entry for up to five seconds.

#### Business logic

Per project, the list is read once and the same answer reused for five seconds; reads made while a read is still running wait for it instead of starting another. A read that failed is not kept, so the next read tries again. The reader can be told a project changed (`provided.ts` says it after any widget command ran there): the project's kept read is dropped, and the next read runs the command again whatever the clock says.
