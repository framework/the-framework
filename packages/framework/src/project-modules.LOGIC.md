A project's modules [1]: which of its packages bring something to the dashboard, plus the modules built into The Framework that every project has; which of their files the dashboard may load; where a module's server part is; and how a module's command is run in the project to read its data. The Framework names no package in the project: any dependency that says it has a module is taken at its word, whoever wrote it. It names only its own built-in modules, one list of package names (today the Files module, `@openagt/files`). Which package provides a kind of The Framework's data, and how a provided command [3] is run, is the shared library's (`agent-data`'s `provided-command.ts`); this file reads the project's packages through it.

## Context

**User story**: a project depends on the `logs` skill's package. The dashboard's sidebar shows a Logs row and the Logs page lists the project's recorded runs, without The Framework knowing the word "logs": the package brings the page, and the page reads the runs with the same `logs` command an agent runs. A project that drops the package loses the page; a package from anyone else that declares a module gets its page the same way.

## Glossary

[1] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command [2], or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.
[2] command: one of a package's executables, as its `package.json` `bin` lists them, run the way an agent runs it with `npx`.
[3] provided command: the command [2] a package declares, in its own `package.json` under `"framework": { "<kind>": "<command>" }`, as answering one kind of The Framework's data for the project: the tickets, the agent queue, the runs, the checkouts (`store/`). Resolved by the shared library, which also applies the project's own choice when two packages declare the same kind.

## Business logic — TL;DR

- **Finding a project's modules** - the dependencies and dev dependencies of the project's own `package.json`, installed in its `node_modules` (links followed), whose package exports `./dashboard` to a file inside the package; then the modules among The Framework's built-in packages (`built-in.ts`), each unless the project has its own copy.
- **A module's server part** - the file its package exports as `./server`, inside the package, when it has one.
- **Which files a module serves** - only files inside the directory of its module, symlinks resolved; nothing else of the package, nothing of the project.
- **Running a module's command** - one of the module package's own commands, picked by name and bounded in arguments, then run the way the shared library runs any package command: with Node in the project root, never through a shell, bounded in time and output; its standard output is read as JSON, a failure answers the command's own last error line.

## Business logic

### Finding a project's modules

#### Context

See `## Context`.

#### Business logic

The project's root `package.json` is read; a project without one, or with one that does not parse, has no module. Every name listed under `dependencies` then `devDependencies` is looked up once, at `<project>/node_modules/<name>`, following a link to wherever it points (a workspace link counts like an install). A name that is not a package name (a path, `..`) is never looked up. A package counts as a module [1] when its `package.json` has an `exports["./dashboard"]` entry, either a plain path or an object whose `browser`, `import` or `default` condition (in that order) is a path, and that path resolves to an existing file inside the package. An uninstalled dependency, a package without the entry, and an entry pointing outside the package or at a missing file bring no module. Then each built-in module's package is looked up where The Framework itself is installed, the same way; one that is not installed there is skipped, and one the project depends on itself is not added a second time: the project's own copy wins, so a project may pin its own version. A project with no `package.json` still has the built-in modules. The modules are answered sorted by package name. For each module the answer carries the package's name and version, the directory its module sits in, the module's file name, and the package's commands [2] by name with their full paths: `bin` given as one path is one command named after the package (without its `@scope/`), `bin` given as a map is one command per entry; and its server part, when its `package.json` has an `exports["./server"]` entry, a plain path or an object whose `node`, `import` or `default` condition (in that order) is a path, resolving to an existing file inside the package.

### Which files a module serves

#### Context

**Problem**: the dashboard loads a module's browser part and its stylesheet by URL from the daemon; that URL must never reach any other file of the package or of the project.

#### Business logic

A file is served for a module only when the requested path, resolved against the module's browser part's directory and with every symlink followed, still lies inside that directory and is a regular file. An empty path, a path climbing out (`../package.json`), a symlink inside the directory pointing outside it, a directory, and a missing file all give nothing.

### Running a module's command

#### Context

**User story**: the Logs page shows each project's runs by running `logs --limit 50` in the project and reading the JSON it prints, exactly what an agent sees with `npx logs --limit 50`.

#### Business logic

The command [2] is picked by name; a package with exactly one command needs no name, a package with several must be told which, and a name the package does not have is refused ("`<package>` has no command `<name>`"). At most 32 arguments of at most 4096 characters each are accepted; more is refused as "too many or too long arguments". The command's file is run with Node, as a package's commands are Node scripts (a provided command [3] runs the same way from here on, with the arguments The Framework gives it), with the arguments as given, in the project's root directory, never through a shell. It may run 30 seconds and print 16 MB. It answers:

- exit 0 and JSON on standard output: that JSON;
- exit 0 and anything else: "`<name>` printed no JSON";
- a non-zero exit: the last line the command wrote to its standard error (a command's refusal, such as "no run is named x"), or the failure itself when it wrote none;
- killed for time: "`<name>` took too long"; stopped for output: "`<name>` printed too much".
