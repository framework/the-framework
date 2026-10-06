The dashboard's three calls about modules [1]: which modules the registered projects have, the built-in ones included; a module running one of its own package's commands [2] in one project, after which the framework forgets what it had read of that project through its providers [3], a command marked as an act [4] first having the project's data branch converged with origin; and a module calling one of its own server part's reads [6] in one project.

## Context

**User story**: the sidebar shows one row per page the installed modules add, whatever projects are registered, like the Overview and Tickets rows; the Logs page lists the runs of every project that has the logs package, each read in its own project; "Add to queue" on a ticket runs the queue package's command, and the Overview's AI Queue card shows the new entry on its next poll, not five seconds later.

## Glossary

[1] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command [2], or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.
[2] command: one of a package's executables, as its `package.json` `bin` lists them, run the way an agent runs it with `npx`.
[3] provider: the command a project's package declares as answering for one kind of the framework's data (the agent queue, the finished agents), which the framework reads and keeps for five seconds (`../store/queue.ts`, `../store/runs.ts`).
[4] act: a module's command run as an action on the project (a link action's, `dashboard/components/LinkActions.tsx`) rather than as a page's read; the call says so with its last argument.
[6] read: one named function of a module's server part, called with the project and a JSON object the browser part sent, answering JSON (`../dashboard/module-host.ts`).
[5] data branch: the `agent-data` branch of the project's repository, where the skills keep their files (the tickets, the queue, the runs); the daemon keeps a checkout of it under `.branches/agent-data` and converges it with origin once a minute.

## Business logic — TL;DR

- **The modules** - every registered project's modules, one entry per package, loaded from the first project (in the registry's order) that has it, with the list of projects that have it.
- **A module's command** - runs only for a registered project, and only a package that is a module of that project; the answer is the command's JSON or its reason; once it has run, the project's provided data is forgotten, so the next read runs its provider again.
- **A module's read** - runs only for a registered project and a module of that project that has a server part; a read about an agent relayed to a connected device is made on that device.
- **An act** - a command marked as an act [4] also has the project's data branch [5] converged with origin before the forgetting, so what the act wrote is read back at once instead of at the daemon's next sync.

## Business logic

### The modules

#### Context

See `## Context`.

#### Business logic

Each registered project's modules are read (a project that cannot be read contributes nothing; the framework's built-in modules are every project's, `../project-modules.ts`) and grouped by package name. Each package appears once, with the URL of its module as served from the first project, in the registry's order, that has it, and the ids of every project that has it, in that same order. When two projects install different versions of one package, the dashboard loads the first project's; each project's data is still read through its own project's copy of the command.

### A module's command

#### Context

**Problem**: the browser names the package whose command it wants run; it must never be able to run any other program on the machine.

#### Business logic

The call names a project, a package, the arguments and, optionally, the command's name. An unknown project is refused ("unknown project"), arguments that are not a list are refused, and a package that is not a module of that project is refused ("`<package>` brings no module to this project"), even when the project depends on it or another project has it as a module. Otherwise the command runs by the rules in `project-modules.ts` and its answer is returned as is. Whatever the command was, once it has run the framework forgets what it had read of that project's providers [3] (`../store/provided.ts`): the command may have written the queue or the runs, and the dashboard's next read must see it rather than a copy kept up to five seconds earlier.

### A module's read

#### Context

**User story**: the Files tab polls its tree every 8 seconds and reads a file on every hover; starting a new process for each would be slow, so a module may bring a server part the daemon calls in its own process.

#### Business logic

The call names a project, a package, the read's name and its input. An unknown project is refused ("unknown project"), a package that is no module of that project is refused ("`<package>` is no module of this project"), and a module without a server part is refused ("`<package>` has no server part"). Otherwise the read is called by the rules in `../dashboard/module-host.ts`, with the project's folder and the facts the core knows about its agents, and its answer is returned. When the input names an agent (`agentId`) that this daemon relays to a connected device, the call is forwarded to that device, whose daemon calls its own copy of the module against its own checkout; a device that does not answer answers "the device this run works on did not answer". Unlike a command, a read never makes the framework forget what it read of the project: a read writes nothing.

### An act

#### Context

**Problem**: in a project that shares its records, a package's command writes as a remote writer, straight to origin, and never moves this machine's copy of the data branch [5]; the daemon converges that copy once a minute. "Add to queue" clicked, the AI Queue card would show the entry a minute later, where the dashboard's own write used to show at once.

#### Business logic

When the call is marked as an act [4], the framework converges the project's data branch [5] with origin right after the command, the same convergence the daemon's clock does (`src/daemon-services.ts`), before forgetting the project's provided data. A convergence that fails is ignored here: the next clock turn reports it. A page's read is never marked so, since it writes nothing and runs every few seconds.
