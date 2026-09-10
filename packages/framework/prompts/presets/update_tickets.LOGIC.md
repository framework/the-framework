The "Update from GitHub" preset, both a launcher button and a routine [3]: the one synchronization of a project's tickets with its GitHub issues. The agent [1] brings across only what changed since the last import, reconciles one ticket per issue through the `tickets` skill [4], removes the tickets of closed issues, and records the time it started as the new import mark; an empty `tickets/` is a first import that brings every open issue across. Its tooltip reads "Bring `tickets/` up to date with the GitHub issues. An empty `tickets/` gets a full first import." It takes no parameter, and from the launcher it always starts an agent of its own, even when clicked from inside an agent's page: syncing is repository work, not a reply.

## Context

**User story**: the user's GitHub issues appear as tickets on the `agent-data` branch [2], keep up with edits, comments and closures on GitHub, and an existing ticket keeps its file name and its plan through an update; the user reads, in one line, how many tickets were added, updated and removed.

**Business logic story**: as a routine, the preset is the first in Auto PM's [5] rotation (the rule in `src/auto-pm.ts`). The import mark `lastImportedAt` lives in `tickets/meta.json` on the `agent-data` branch, read by the agent out of the repository rather than rendered into the prompt: the mark travels in the same commit as the tickets it describes, so an agent whose work never landed cannot leave behind a mark claiming those issues were imported.

**Problem**: an issue edited while the import runs would be missed if the mark were taken at the end; taking the mark before fetching anything means such an issue is simply picked up by the next update.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[3] routine: a preset the daemon fires on its own on a schedule, each switchable off and runnable on demand.
[4] skill: one of the four capabilities an agent is taught (`branches`, `tickets`, `queue`, `logs`), each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.
[5] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[6] plan: a ticket's `.plan.md`: effort and uncertainty ratings and how to implement it.
[7] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.

## Business logic — TL;DR

- **Take the time first** - the agent notes the current UTC time, in ISO 8601, before fetching anything; that is the mark it records at the end.
- **Three ways to start** - existing tickets without an import mark, or a missing or logged-out `gh`, is an error to report and abort on; no tickets at all is a first import of every open issue; otherwise only the issues and comments updated since the mark are fetched.
- **Reconcile one ticket per issue** - a new issue gets a ticket, an existing ticket is updated in place keeping its file name and its plan, comments are folded in only where they change the work, and a closed issue's ticket is removed with its plan and claim.
- **Record the mark and report** - the noted time is written as the new import mark, and one line says how many tickets were added, updated and removed.

## Business logic

### Take the time first

#### Context

See `## Context`.

#### Business logic

Before fetching anything, the agent [1] notes the current UTC time in ISO 8601. That time, not the time it finishes, is the import mark it records at the end.

### Three ways to start

#### Context

**Problem**: a ticket set that exists but carries no import mark cannot be updated incrementally without risking a duplicate of every ticket; and without a working, logged-in `gh` nothing can be fetched at all.

#### Business logic

The agent [1] reads the import mark `lastImportedAt` off `tickets/meta.json` on the `agent-data` branch [2], and asks `tickets list` whether any tickets exist. Then exactly one of:

- Error: there are tickets but the mark is missing, or `gh` is missing, or `gh` is logged out. The agent reports the error, saying which of those it is, and aborts.
- Empty: there are no tickets. The agent treats it as a first import and brings every open issue across.
- Update: the agent fetches only what changed: the issues of every state updated since the mark, up to 500, with their number, title, body, state, labels and update time, and the discussion comments created or edited since the mark.

### Reconcile one ticket per issue

#### Context

**User story**: a ticket the user or an agent already planned keeps its plan [6] through an update, at most marked as possibly outdated, and a ticket never changes its file name, so links to it keep working.

#### Business logic

The agent [1] reconciles the fetched issues with the tickets, one ticket file per issue, each written with `tickets put <file>`:

- An issue with no ticket yet gets one.
- An issue that already has a ticket has that ticket updated in place: its file name is kept, and its plan [6] is kept, though the agent considers marking the plan `outdated: yes`.
- New comments are folded into the ticket only where they change what the work is; the thread is never pasted.
- An issue that is now closed has its ticket removed with `tickets close <file>`, which takes the ticket's plan and claim [7] with it.

### Record the mark and report

#### Context

See `## Context`.

#### Business logic

The agent [1] finishes by writing `tickets/meta.json` through `tickets put meta.json` with `{"lastImportedAt": "<the UTC time noted at the start>"}`, and says in one line how many tickets it added, updated and removed.
