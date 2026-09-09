The package's command line: the same operations a caller calls, for an agent (or a person) in a shell, in any clone of the repository — so an agent reads the queue and changes it through the one implementation a caller uses, and a second surface is never a second behaviour.

## User story

- An agent, started in a clone that holds no copy of the queue, reads it in the order it is worked.
- An agent puts an entry on the queue, and takes one off once its work is done.
- The user, in a terminal, does the same without any other tool.

## Glossary

- **refusal** - a rule saying no to a command: an entry the queue does not have. Not a failure: the command ran, and the answer is "not this one".

## Business logic — TL;DR

- **Three commands over the package** - the bare command, `add`, `done`; each is the corresponding package operation and nothing more.
- **JSON out, a reason for a person, an exit code that says which** - every result is one JSON document on stdout; a refusal or a git failure also puts one line on stderr and exits 1; a command that cannot be read gets the usage on stderr and exits 2.
- **Reads come off origin, fetched once** - so a command sees what every writer pushed, its own earlier writes included.
- **Writes are a remote writer's** - one commit each, pushed straight to the branch, never touching a caller's persistent checkout; a repository with no remote is refused.

## Business logic

### Three commands over the package

#### User story

See `## User story`.

#### Business logic

- the bare command, no arguments - the queue's open entries, in order of work, as a JSON array.
- `add <text> [--priority N]` - puts an entry on the queue, in its `## Priority N` section when a priority is given, else at the end of the file; the queue file is created when the branch has none. An empty entry, or a priority outside 0 to 10, is a usage error.
- `done <text>` - takes an entry off the queue; the text must match an open entry exactly, as the bare command printed it. Done means deleted. An entry the queue does not have is refused.

### JSON out, a reason for a person, an exit code that says which

#### User story

An agent parses what it is told; a person reads it; a script branches on the exit code.

#### Business logic

Every command writes exactly one JSON document to stdout. A result is the operation's outcome. A refusal is `{ ok: false, reason }` — the reason a short fixed word plus what identifies the case (the entry) — with one sentence on stderr saying the same for a person, and exit code 1. The reasons: `no-entry`, `no-remote`, `not-a-repo`. A git failure past the decision is reported the same way, reason `git-failed`, with git's own line. A command that cannot be read — an unknown command, an argument missing or extra, an unknown option, an empty entry, a priority that is not 0 to 10 — gets the usage on stderr, no JSON, and exit code 2.

### Reads come off origin, fetched once

#### User story

An agent reads the queue right after adding to it, and sees the entry it added.

#### Business logic

A read fetches the branch once, up front, and reads origin's copy — so the command sees what every writer pushed, including its own earlier writes, which never move any ref in the agent's own clone. A repository with no remote reads its local copy of the branch instead. Outside any repository the command is refused as `not-a-repo` rather than failing on git — only git's own "not a repository" reads as that; a timeout, a missing git or a corrupt repository stays the failure it is.

### Writes are a remote writer's

#### User story

An agent changes the queue from a clone that holds no checkout of the branch, while a long-lived process on another machine is writing to it too.

#### Business logic

Each write is one commit: origin's tip is fetched and checked out in a throwaway checkout, the change applied, committed, and pushed straight to the `agent-data` branch, and the throwaway checkout removed. A push that loses a race re-fetches origin's tip and re-applies the same change before pushing again. Nothing lands in the agent's own working tree, and the persistent checkout a long-lived process keeps is never touched — it belongs to that process, and converges on its own next pull.

A repository with no remote is refused as `no-remote`: a change nothing can carry is the user's error state, not a mode this supports.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
