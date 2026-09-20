How The Framework reads a project's tickets [1]: through the tickets provider [2], a command one of the project's own packages declares, never through a package The Framework knows. It also owns the shape of what that command answers: a ticket's row [3].

## Context

**User story**:
- The user opens the Overview and sees, on the hot-tickets card, which tickets are being worked on, which the agent queue holds, and which are flagged high priority; the onboarding checklist offers to populate the tickets of a project that can have them, and ticks the step once it has some.
- A project that installed no tickets package has no tickets: the card shows none of it, and the onboarding step about tickets does not apply.
- Browsing, planning, claiming and releasing tickets are not The Framework's: the tickets package brings its own widget [4] for that, which reads and changes them through the same command.

**Business logic story**: The Framework names no skill. A project picks the package that keeps its tickets by listing it as a dependency; that package says, in its own package.json, which of its commands answers for the tickets (`"framework": { "tickets": "tickets" }` for the `tickets` skill's package). The Framework only reads, and only for what it composes across skills.

**Problem**: the dashboard reads every project's tickets on several polls every few seconds, and every read of the provider is a process.

## Glossary

[1] ticket: a piece of work proposed for the project, kept by a project package (the `tickets` skill keeps it as a markdown file under `tickets/` on the `agent-data` branch, with its plan and its claim beside it).
[2] tickets provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's tickets [1], in its own package.json under `"framework": { "tickets": "<command>" }`.
[3] a ticket's row: one ticket as the provider's command lists it: its file name (its identity, and what a link to it names as `tickets/<file>`), its title, a one-line summary, the file's date, whether a plan sits beside it; and, when the ticket has them, its priority as written (`0` to `10`), its topics, the issue it tracks and the pull request that closes it (each a label and a URL), whether and by whom it is claimed, and its plan's effort and uncertainty.
[4] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard, offers actions on the links pages show, and reads and changes its data through its own package's command.

## Business logic — TL;DR

- **Which command provides** - the first of the project's dependencies, in its package.json's order, that declares a tickets provider [2] naming one of its own commands; no dependency declares one, the project has no tickets.
- **The command line it answers** - `<command> list --local`: every open ticket's row [3], as one JSON array, from the copy on this machine with no network. Nothing else: The Framework never writes a ticket.
- **The shape** - of the array, the objects carrying the five plain facts (file, title, summary, date, planned) are rows, everything else on them kept as printed; anything else, a failure included, reads as no tickets, never an error.
- **Reads are shared for five seconds, and forgotten when a widget acts** - the same project's tickets read again within five seconds reuses the answer; reads at the same moment share one call; a widget's command having run in the project forgets the read, so the next one runs the command again.

## Business logic

### Which command provides

#### Context

See `## Context`.

#### Business logic

The project's own package.json is read; its `dependencies` then `devDependencies` are taken in their order, a name listed twice read once. Each is looked up in the project's `node_modules`, links followed. The first whose own package.json declares `"framework": { "tickets": "<command>" }`, where `<command>` is one of that package's own commands, is the tickets provider [2]. A declaration naming a command the package does not have is skipped. No package.json, no installed dependency, or no declaration: the project has no tickets provider, and the project has no tickets (`undefined`, which the Overview reads as nothing to show and the onboarding as nothing to populate). The provider is looked up again at most every five seconds, so a project that installs, swaps or drops its provider is read the new way within five seconds.

### The command line it answers

#### Context

**Business logic story**: the command is the same one an agent runs to list the tickets; The Framework uses the one flag an agent does not.

#### Business logic

The provider's command runs with Node, in the project's root, never through a shell, for at most 30 seconds and 16 MB of output (the rules of `project-widgets.ts`). One call, `<command> list --local`, prints every open ticket's row [3] as one JSON array and exits 0; `--local` asks for the copy kept on this machine, read without contacting the remote, because The Framework polls. Anything else, an exit code, no JSON, JSON that is not an array, reads as no tickets. That is the whole contract: The Framework has no call that writes a ticket; a claim released by hand, a plan asked for, a ticket queued are the widget's [4], through its own command.

### The shape

#### Context

See `## Context`.

#### Business logic

Of the array the command prints, an object is a row [3] when its file name is a non-empty string, its title, summary and date are strings and its planned flag a boolean; everything else printed on it (priority, topics, the issue and pull request links, the claim, effort, uncertainty) is kept as printed and not checked here. Anything that is not such an object is dropped; the order is kept.

### Reads are shared for five seconds, and forgotten when a widget acts

#### Context

**Problem**: see `## Context`. And the widget's release of a claim writes through the widget's own command, which The Framework does not see; a read cached a moment before would show the claim for up to five seconds.

#### Business logic

Per project, the list is read once and the same answer reused for five seconds; reads made while a read is still running wait for it instead of starting another. A read that failed is not kept, so the next read tries again. The reader can be told a project changed (`provided.ts` says it after any widget command ran there): the project's kept read is dropped, and the next read runs the command again whatever the clock says.
