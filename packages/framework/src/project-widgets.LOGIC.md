A project's widgets [1]: which of its packages bring something to the dashboard, which of their files the dashboard may load, and how a widget's command is run in the project to read its data. The Framework names no package: any dependency that says it has a widget is taken at its word, whoever wrote it. Which package provides a kind of The Framework's data, and how a provided command [3] is run, is the shared library's (`agent-data`'s `provided-command.ts`); this file reads the project's packages through it.

## Context

**User story**: a project depends on the `logs` skill's package. The dashboard's sidebar shows a Logs row and the Logs page lists the project's recorded runs, without The Framework knowing the word "logs": the package brings the page, and the page reads the runs with the same `logs` command an agent runs. A project that drops the package loses the page; a package from anyone else that declares a widget gets its page the same way.

## Glossary

[1] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard and reads its data through its own package's command [2].
[2] command: one of a package's executables, as its `package.json` `bin` lists them, run the way an agent runs it with `npx`.
[3] provided command: the command [2] a package declares, in its own `package.json` under `"framework": { "<kind>": "<command>" }`, as answering one kind of The Framework's data for the project: the tickets, the agent queue, the runs, the checkouts (`store/`). Resolved by the shared library, which also applies the project's own choice when two packages declare the same kind.

## Business logic — TL;DR

- **Finding a project's widgets** - the dependencies and dev dependencies of the project's own `package.json`, installed in its `node_modules` (links followed), whose package exports `./dashboard` to a file inside the package.
- **Which files a widget serves** - only files inside the directory of its module, symlinks resolved; nothing else of the package, nothing of the project.
- **Running a widget's command** - one of the widget package's own commands, picked by name and bounded in arguments, then run the way the shared library runs any package command: with Node in the project root, never through a shell, bounded in time and output; its standard output is read as JSON, a failure answers the command's own last error line.

## Business logic

### Finding a project's widgets

#### Context

See `## Context`.

#### Business logic

The project's root `package.json` is read; a project without one, or with one that does not parse, has no widget. Every name listed under `dependencies` then `devDependencies` is looked up once, at `<project>/node_modules/<name>`, following a link to wherever it points (a workspace link counts like an install). A name that is not a package name (a path, `..`) is never looked up. A package counts as a widget [1] when its `package.json` has an `exports["./dashboard"]` entry, either a plain path or an object whose `browser`, `import` or `default` condition (in that order) is a path, and that path resolves to an existing file inside the package. An uninstalled dependency, a package without the entry, and an entry pointing outside the package or at a missing file bring no widget. The widgets are answered sorted by package name. For each widget the answer carries the package's name and version, the directory its module sits in, the module's file name, and the package's commands [2] by name with their full paths: `bin` given as one path is one command named after the package (without its `@scope/`), `bin` given as a map is one command per entry.

### Which files a widget serves

#### Context

**Problem**: the dashboard loads a widget's module and its stylesheet by URL from the daemon; that URL must never reach any other file of the package or of the project.

#### Business logic

A file is served for a widget only when the requested path, resolved against the widget module's directory and with every symlink followed, still lies inside that directory and is a regular file. An empty path, a path climbing out (`../package.json`), a symlink inside the directory pointing outside it, a directory, and a missing file all give nothing.

### Running a widget's command

#### Context

**User story**: the Logs page shows each project's runs by running `logs --limit 50` in the project and reading the JSON it prints, exactly what an agent sees with `npx logs --limit 50`.

#### Business logic

The command [2] is picked by name; a package with exactly one command needs no name, a package with several must be told which, and a name the package does not have is refused ("`<package>` has no command `<name>`"). At most 32 arguments of at most 4096 characters each are accepted; more is refused as "too many or too long arguments". The command's file is run with Node, as a package's commands are Node scripts (a provided command [3] runs the same way from here on, with the arguments The Framework gives it), with the arguments as given, in the project's root directory, never through a shell. It may run 30 seconds and print 16 MB. It answers:

- exit 0 and JSON on standard output: that JSON;
- exit 0 and anything else: "`<name>` printed no JSON";
- a non-zero exit: the last line the command wrote to its standard error (a command's refusal, such as "no run is named x"), or the failure itself when it wrote none;
- killed for time: "`<name>` took too long"; stopped for output: "`<name>` printed too much".
