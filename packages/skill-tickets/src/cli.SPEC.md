The package's command line: the same operations a caller calls, for an agent (or a person) in a shell, in any clone of the repository — so an agent reads the tickets, claims one and changes them through the one implementation a caller uses, and a second surface is never a second behaviour.

## User story

- An agent, started in a clone that holds none of the tickets, lists them, reads one with its plan, and learns who holds it.
- An agent claims a ticket before planning or working it, and is told to pick another when someone already holds it.
- An agent writes a ticket or a plan, closes a ticket it finished, and keeps the queue current.
- The user, in a terminal, does all of the same without any other tool.

## Glossary

- **refusal** - a rule saying no to a command: a ticket that does not exist, a ticket someone else holds, a filename this command does not write. Not a failure: the command ran, and the answer is "not this one".

## Business logic — TL;DR

- **Nine commands over the package** - `list`, `show`, `queue`, `queue add`, `queue done`, `put`, `close`, `claim`, `release`; each is the corresponding package operation and nothing more.
- **JSON out, a reason for a person, an exit code that says which** - every result is one JSON document on stdout; a refusal or a git failure also puts one line on stderr and exits 1; a command that cannot be read gets the usage on stderr and exits 2.
- **Reads come off origin, fetched once** - so a command sees what every writer pushed, its own earlier writes included.
- **Writes are a remote writer's** - one commit each, pushed straight to the branch, never touching a caller's persistent checkout; a repository with no remote is refused.
- **The holder is read, not typed** - a claim and a release name whoever the working directory says they are.

## Business logic

### Nine commands over the package

#### User story

See `## User story`.

#### Business logic

- `list` - every open ticket, as the rows the reader produces (`tickets`): file, title, summary, priority, topics, the GitHub link, date, planned, effort, uncertainty, locked, and who holds it.
- `show <file>` - one ticket with its whole text, its plan when it has one, and the holder when it is claimed.
- `queue` - the queue's open entries, in order of work.
- `queue add <text> [--priority N] [--ticket <file>]` - puts an entry on the queue, in its `## Priority N` section when a priority is given, else at the end of the file. With a ticket named, the entry becomes a markdown link back to that ticket and is placed by the ticket's own priority unless a priority was given — the same entry a caller writes when it queues a ticket. An empty entry, or a priority outside 0 to 10, is a usage error; a ticket that does not exist is a refusal.
- `queue done <text>` - takes an entry off the queue; the text must match an open entry exactly. Done means deleted.
- `put <file>` - writes one file under `tickets/` from standard input: a ticket, its `.plan.md`, or `meta.json`. Anything else — a `.lock.md`, a path with segments, a non-markdown name — is refused. Claims are never written this way; they go through `claim`.
- `close <file>` - removes a ticket together with its plan and its claim, because `tickets/` holds only open tickets. A ticket that is not there is refused; so is a ticket someone else holds, naming the holder — closing would take their claim with the ticket.
- `claim <file>` - claims a ticket for the holder the working directory names, before planning or working it. A ticket that does not exist is refused; a ticket someone else holds is refused *and told who holds it* (when the lock names anyone readable), so the agent can back off and pick another. A claim naming this very holder again still counts as claimed, so an agent that re-runs the command after a lost race is not confused by its own lock.
- `release <file>` - lifts the caller's own claim. A ticket with no claim, and a claim belonging to someone else, are both refused — the second naming the holder it belongs to.

A ticket is named either by its bare filename or by its `tickets/<file>` path; anything that is neither is refused before anything is read.

The claim a `claim` makes is the "about to implement" kind: an existing plan is not in the way, only someone's existing claim is.

### JSON out, a reason for a person, an exit code that says which

#### User story

An agent parses what it is told; a person reads it; a script branches on the exit code.

#### Business logic

Every command writes exactly one JSON document to stdout. A result is the operation's outcome. A refusal is `{ ok: false, reason }` — the reason a short fixed word plus what identifies the case (the file, the entry, the holder) — with one sentence on stderr saying the same for a person, and exit code 1. The reasons: `no-ticket`, `claimed` with the holder, `not-holder` with the holder, `no-lock`, `no-identity`, `no-remote`, `not-a-repo`, `invalid-path`, `no-entry`. A git failure past the decision is reported the same way, reason `git-failed`, with git's own line. A command that cannot be read — unknown command, an argument missing or extra, an unknown option, a priority that is not 0 to 10 — gets the usage on stderr, no JSON, and exit code 2.

### Reads come off origin, fetched once

#### User story

An agent lists the tickets right after writing one, and sees the one it wrote.

#### Business logic

A read fetches the branch once, up front, and every read of that command then goes to origin's copy — so the command sees what every writer pushed, including its own earlier writes, which never move any ref in the agent's own clone. A repository with no remote reads its local copy of the branch instead. Outside any repository the command is refused as `not-a-repo` rather than failing on git — only git's own "not a repository" reads as that; a timeout, a missing git or a corrupt repository stays the failure it is.

### Writes are a remote writer's

#### User story

An agent changes a ticket from a clone that holds no checkout of the branch, while a long-lived process on another machine is writing to it too.

#### Business logic

Each write is one commit: origin's tip is fetched and checked out in a throwaway checkout, the change applied, committed, and pushed straight to the `tickets` branch, and the throwaway checkout removed. A push that loses a race re-fetches origin's tip and re-applies the same change before pushing again. Nothing lands in the agent's own working tree, and the persistent checkout a long-lived process keeps is never touched — it belongs to that process, and converges on its own next pull.

A repository with no remote is refused as `no-remote`: a change nothing can carry is the user's error state, not a mode this supports.

### The holder is read, not typed

#### User story

An agent claims a ticket without ever having been told an identity.

#### Business logic

`claim` and `release` name the holder the working directory says they are (`holder`): the agent id inside an agent's checkout, else the current branch name. A checkout on no branch is refused as `no-identity` — there is nothing to claim as.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
