Which of a project's installed packages provides one kind of The Framework's data (the tickets, the agent queue, the runs, the checkouts, the git host), and how such a package's command is run to read it. Neither The Framework nor the scheduler names a package: a package says in its own `package.json` what it provides, and when two installed packages say the same thing, the project's own `package.json` says which one it takes.

## Context

**User story**: a project depends on the `tickets` skill's package; the dashboard shows the project's tickets without knowing the word "tickets": the package declares that its `tickets` command answers that kind of data, and the dashboard runs it. A project that installs both a GitHub package and a GitLab package, each declaring it provides the git host, sees a red banner naming both and the one line to write in its `package.json`; once the line names one, that one provides the git host and the banner is gone.

**Problem**: with two packages declaring the same kind, taking the first in dependency order silently makes the project's behaviour depend on the order of a JSON file nobody reads for that.

## Glossary

[1] kind: one sort of The Framework's data a package may provide: `tickets`, `queue`, `runs`, `branches`, `git-host`. A kind is a word both sides agree on; The Framework knows the kinds, never the packages.
[2] provided command: the command a package declares, in its own `package.json` under `"framework": { "<kind>": "<command>" }`, naming one of its own `bin` entries, as answering one kind [1] for the project.
[3] the project's line: the entry in the project's own root `package.json`, `"framework": { "<kind>": "<package name>" }`, naming which installed package provides a kind [1] when several declare it.

## Business logic — TL;DR

- **The project's installed packages** - every name the project's `package.json` lists under `dependencies` then `devDependencies`, read once, resolved from its `node_modules` with links followed; a missing `package.json`, a name that is not a package name and an uninstalled dependency contribute nothing.
- **A package's commands** - its `bin` entries by name, as absolute paths; a `bin` given as one path is one command named after the package without its scope.
- **Who provides a kind** - the packages whose own `package.json` declares the kind naming one of their commands are its providers; exactly one provider provides; several: the one the project's line [3] names, else none, with the reason; a line naming a package that is not a provider: none, with the reason; no provider: nothing, and no problem.
- **Running a package's command** - with Node, in the project root, never through a shell, 30 seconds and 16 MB at most; its standard output read as JSON, a failure answered by the command's own last error line.

## Business logic

### Who provides a kind

#### Context

See `## Context`.

#### Business logic

The providers of a kind [1] are the project's installed packages whose own `package.json` has a `framework` object with, under the kind, the name of one of the package's own commands; a declaration naming a command the package does not have, or anything that is not a string, is no declaration. Then:

- no provider: the answer is empty, and there is no problem; the project has none of that data;
- one provider and no line [3] for the kind: it provides;
- a line naming a provider: that one provides, whatever the others;
- a line naming a package that is not a provider: nothing provides, and the problem reads "package.json names <name> for <kind>, which does not provide it", followed by "; the providers are <names>" when there are any;
- two or more providers and no line: nothing provides, and the problem reads "<n> packages provide <kind>: <names>; name one under \"framework\" in package.json".

The command answered names the package, the command and the command's file. A caller that only needs to run the command gets the command or nothing (`readProvidedCommand`); a caller that must tell the user why nothing gets the problem too (`lookupProvidedCommand`).

### Running a package's command

#### Context

**Business logic story**: the dashboard reads a project's checkouts by running the branches package's `list` and reading the JSON it prints, exactly what an agent sees running `npx branches list`.

#### Business logic

The command's file is run with Node, with the arguments as given, in the project's root directory, never through a shell. It may run 30 seconds and print 16 MB. It answers:

- exit 0 and JSON on standard output: that JSON;
- exit 0 and anything else: "<name> printed no JSON";
- a non-zero exit: the last line the command wrote to its standard error (a command's refusal), or the failure itself when it wrote none;
- killed for time: "<name> took too long"; stopped for output: "<name> printed too much".
