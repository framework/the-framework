The dashboard's two calls about widgets [1]: which widgets the registered projects bring, and a widget running one of its own package's commands [2] in one project, after which the framework forgets what it had read of that project through its providers [3].

## Context

**User story**: the sidebar shows one row per page the installed widgets add, whatever projects are registered, like the Overview and Tickets rows; the Logs page lists the runs of every project that has the logs package, each read in its own project; "Add to queue" on a ticket runs the queue package's command, and the Overview's AI Queue card shows the new entry on its next poll, not five seconds later.

## Glossary

[1] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard and reads its data through its own package's command [2].
[2] command: one of a package's executables, as its `package.json` `bin` lists them, run the way an agent runs it with `npx`.
[3] provider: the command a project's package declares as answering for one kind of the framework's data (the agent queue, the finished agents), which the framework reads and keeps for five seconds (`../store/queue.ts`, `../store/runs.ts`).

## Business logic — TL;DR

- **The widgets** - every registered project's widgets, one entry per package, loaded from the first project (in the registry's order) that has it, with the list of projects that have it.
- **A widget's command** - runs only for a registered project, and only a package that is a widget of that project; the answer is the command's JSON or its reason; once it has run, the project's provided data is forgotten, so the next read runs its provider again.

## Business logic

### The widgets

#### Context

See `## Context`.

#### Business logic

Each registered project's widgets are read (a project that cannot be read contributes nothing) and grouped by package name. Each package appears once, with the URL of its module as served from the first project, in the registry's order, that has it, and the ids of every project that has it, in that same order. When two projects install different versions of one package, the dashboard loads the first project's; each project's data is still read through its own project's copy of the command.

### A widget's command

#### Context

**Problem**: the browser names the package whose command it wants run; it must never be able to run any other program on the machine.

#### Business logic

The call names a project, a package, the arguments and, optionally, the command's name. An unknown project is refused ("unknown project"), arguments that are not a list are refused, and a package that is not a widget of that project is refused ("`<package>` brings no widget to this project"), even when the project depends on it or another project has it as a widget. Otherwise the command runs by the rules in `project-widgets.ts` and its answer is returned as is. Whatever the command was, once it has run the framework forgets what it had read of that project's providers [3] (`../store/provided.ts`): the command may have written the queue or the runs, and the dashboard's next read must see it rather than a copy kept up to five seconds earlier.
