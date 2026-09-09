The package's command line: the reads a caller's pages do, for an agent (or a person) in a shell, in any clone of the repository — so an agent reads the runs through the one implementation a caller uses, and a second surface is never a second behaviour. Read-only: an agent's run is recorded by the process that ran it.

## User story

- An agent, started in a clone that holds no copy of the runs, reads the ones that worked its ticket before it plans or works it, and what those agents said.
- The user, in a terminal, does the same without any other tool.

## Glossary

- **refusal** - a rule saying no to a command: a run nobody has. Not a failure: the command ran, and the answer is "not this one".

## Business logic — TL;DR

- **Two commands over the package** - the bare command lists, `show` opens one run; each is the corresponding read and nothing more.
- **The list is narrowed and capped** - by ticket, by branch, and to the newest 20 unless told otherwise; the cards past the cap are never read.
- **The agent sees the package's fields only** - never the writer's bookkeeping under `caller`, and of the diary only the four kinds the package knows.
- **JSON out, a reason for a person, an exit code that says which** - every result is one JSON document on stdout; a refusal or a git failure also puts one line on stderr and exits 1; a command that cannot be read gets the usage on stderr and exits 2.
- **Reads come off origin, fetched once** - so a command sees every run every machine pushed.

## Business logic

### Two commands over the package

#### User story

See `## User story`.

#### Business logic

- the bare command, `[--ticket <file>] [--branch <name>] [--limit N]` - the runs, newest first, as a JSON array of cards.
- `show <id>` - one run: its card, plus `diary`, the agent's lines in order. An id that is not one is a usage error; an id no run has is refused.

### The list is narrowed and capped

#### User story

An agent asks for one ticket's runs and gets those, not a history of hundreds.

#### Business logic

The runs are walked newest first from the branch's directory listings alone. `--ticket <file>` keeps a run whose card worked that ticket, by its exact path or by its file name; `--branch <name>` a run whose card names that branch; both together, both. The list stops at the cap — 20 unless `--limit` gives a whole number above 0 — counting the runs kept, and the cards past it are never read.

### The agent sees the package's fields only

#### Business logic

A card is printed without `caller`. `show` prints the diary's four kinds — what the agent said, its result, how the run ended, what it cost — in order, and no other line; a run with no diary file has none.

### JSON out, a reason for a person, an exit code that says which

#### User story

An agent parses what it is told; a person reads it; a script branches on the exit code.

#### Business logic

Every command writes exactly one JSON document to stdout. A refusal is `{ ok: false, reason }` — the reason a short fixed word plus what identifies the case (the id) — with one sentence on stderr saying the same for a person, and exit code 1. The reasons: `no-run`, `not-a-repo`. A git failure past the decision is reported the same way, reason `git-failed`, with git's own line. A command that cannot be read — an unknown command, an argument missing or extra, an unknown option, a limit that is not a whole number above 0, an id that is not one — gets the usage on stderr, no JSON, and exit code 2.

### Reads come off origin, fetched once

#### User story

An agent on one machine reads the run the daemon on another machine recorded a minute ago.

#### Business logic

A read fetches the branch once, up front, and reads origin's copy — so the command sees every run every writer pushed. A repository with no remote reads its local copy of the branch instead. Outside any repository the command is refused as `not-a-repo` rather than failing on git — only git's own "not a repository" reads as that; a timeout, a missing git or a corrupt repository stays the failure it is. Nothing lands in the agent's own clone: no ref moves, no checkout is made.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
