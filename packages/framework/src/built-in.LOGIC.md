The packages The Framework ships for every project, the built-in packages [1]: which they are, where they are installed, and the three things a project gets from them when it has no package of its own for the job: the provider of a kind of data, the commands a hook line can name, and the hook lines written when the project is added.

## Context

**User story**: the user adds an empty folder as a project. It has no `package.json` and nothing installed. Start works, the agent shows in the dashboard while it works and after it ends, and its files show in the side rail: the runner, the package that reads a project's runs, the one that reads its checkouts and the Files module all come with the dashboard. A project that installed its own copy of any of them keeps using its own.

**Problem**: every tool the dashboard uses was found in the project's own installed packages. A folder with nothing installed could not start an agent, and when a start line was written for it by hand, the dashboard could not see the agent it started.

## Glossary

[1] built-in package: a package The Framework itself depends on and uses for every project, through the same contract as a project's own package. The list: `@gemstack/files`, `@gemstack/skill-branches`, `@gemstack/skill-logs`, `agent-runner`.
[2] kind: one sort of The Framework's data a package may provide: `tickets`, `queue`, `runs`, `branches`, `git-host`.

## Business logic — TL;DR

- **The list** - four packages, named in one place; nothing else in The Framework names a package. Each is found in The Framework's own install, once; one that is not installed is skipped.
- **Who provides a kind** - the project's own packages first, by the shared library's rule; only when none of them declares the kind is a built-in package that declares it the provider.
- **The commands a hook line can name** - the directories of the built-in packages' commands, which a hook line's `PATH` gains after the project's own installed tools.
- **Writing hook lines** - every package that declares it writes hook lines is run with `init` in the project: the project's own packages, then the built-in ones the project has no copy of.

## Business logic

### The list

#### Context

See `## Context`.

#### Business logic

The built-in packages [1] are resolved from The Framework's own install, by name, the first time they are asked for; a package that cannot be found there is skipped. What a built-in package brings is decided by the package itself, exactly as for a project's own package: it is a module when it exports `./dashboard` (`project-modules.ts`), a provider when its `package.json` declares a kind [2], and a writer of hook lines when it declares `hooks`.

### Who provides a kind

#### Context

**Business logic story**: the dashboard reads a project's runs, checkouts, tickets, queue and git host through whichever package declares that kind [2] (`agent-data`'s `provided-command.ts`).

#### Business logic

The lookup is the shared library's, handed the built-in packages [1]: the project's own installed packages are asked first, and the rule between several of them is unchanged. Only when none of the project's packages declares the kind is a built-in package that declares it the provider. So a project with nothing installed has its runs read by `@gemstack/skill-logs` and its checkouts by `@gemstack/skill-branches`, and has no tickets, no queue and no git host, since no built-in package declares those.

### The commands a hook line can name

#### Context

**Business logic story**: a project's hook lines run through the shell (`project-hooks.ts`), and a line names its tool bare, with no `npx`.

#### Business logic

The directories holding the built-in packages' [1] commands are listed, each once. `project-hooks.ts` puts them on a line's `PATH` after the project's own `node_modules/.bin`, so `agent-runner` in a line is the project's copy when it installed one and the built-in one otherwise.

### Writing hook lines

#### Context

**Business logic story**: when a project is added (`daemon-runtime.ts`), its hooks file must hold a `start` line, or the launcher cannot start an agent.

#### Business logic

A package declares `"framework": { "hooks": "<command>" }` in its `package.json`, naming one of its own commands. For the project's own installed packages, then for each built-in package [1] the project has no copy of, every such command is run in the project with the argument `init`; the command writes its own lines into the project's hooks file and keeps every line already there. A command that fails is answered as one line, "<package>: <its error>", and the others still run.
