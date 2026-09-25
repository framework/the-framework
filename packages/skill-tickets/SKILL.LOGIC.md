The instructions every agent [1] reads before touching a ticket: where the tickets live, how to read and change them with the `tickets` command, how to claim a ticket so no two agents work the same one, how to put one on the agent queue [2], and the three formats, a ticket, a claim [3] and a plan. Linked into the agent's checkout [4] where the coding agent's harness looks for skills, it is what turns the command into a skill [5]. Every line is one an agent following the file would go wrong without: the file explains nothing the command's own answers already say.

## Context

**User story**: an agent starting on a task finds the project's roadmap in its tickets, picks one it may work, claims it, plans or implements it, and hands the ticket's bookkeeping back in a state the user and the next agent can trust: a claim lifted, a ticket closed once merged, a queue entry [6] removed.

**Business logic story**: everything the skill says the command does is enforced by the rules in `src/cli.ts`; the formats are what `src/tickets.ts` parses and `src/names.ts` judges; the dashboard offers a ticket to the queue as a link at the priority `src/names.ts` gives it.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[3] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] skill: a capability an agent is taught: a package with the instructions the agent reads (its `SKILL.md`) and a command the agent runs through `npx`.
[6] queue entry: an item on the agent queue.
[7] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[8] holder: who a claim names: the agent's id when the program that started the agent set it in `AGENT_ID` (`agent-runner` does), else the branch the `tickets` command ran on.

## Business logic — TL;DR

- **Where the tickets are and how to reach them** - tickets live on the `agent-data` branch, never on a code branch; the root `tickets` link is a possibly stale copy never to be written; the agent installs the repository's dependencies if needed and runs `npx tickets`, whose every change is one commit pushed straight to the branch, and never passes `--local` or `--force`.
- **How the command answers, and how a ticket is named** - one JSON document per command; a refusal is `{"ok":false,"reason":…}` with why on stderr and exit 1, a wrong command line the usage on stderr and exit 2; every `<file>` is a ticket's filename or the `tickets/…` path a queue entry links to, and `put` also takes the ticket's `.plan.md` and `meta.json`.
- **Reading** - `list` gives every open ticket as one JSON array of rows; `show <file>` gives one ticket with its text, its plan and who holds it; `meta` gives when the tickets last caught up with the issue tracker.
- **Changing** - `put <file>` writes one whole file under `tickets/` from stdin, a ticket, its plan or `meta.json`; `close <file>`, when the ticket is not wanted or for the tracker update once its pull request merged, removes the ticket with its plan and claim, refused while someone else holds it, and leaves its queue entry to `npx queue done`.
- **Claim before planning or working** - `claim <file>` makes the ticket the agent's, naming who claimed it before so the agent reads what they did first, or names who holds it; on someone else's the agent picks another and never removes or overwrites their claim; `release <file>` lifts the agent's own claim when done and before it stops, since nothing lifts a claim on a timeout; `put` ignores claims; the agent claims as `AGENT_ID` when set, else as its current branch, so it releases from the branch it claimed on.
- **Queueing a ticket, and the ticket in review** - with the `queue` skill present, a ticket goes on the agent queue as a markdown link labeled with its title, at the ticket's own `Priority:` (5 when it has none); once its pull request is open the agent marks the entry done by its exact text, writes the pull request into the ticket as its `PR:` line and releases its claim, and names the ticket (and its issue) in the pull request's body; the ticket closes when the pull request merges, never before.
- **The ticket format** - `tickets/<DATE>_<SLUG>.md`: optional `Priority:`, `Topics:`, `Issue:`, `PR:` and `Waiting:` above a `# ` title, a `PR:` line meaning the ticket is in review and a `Waiting:` line that it waits on something outside the work, either one meaning it is not to be chosen or queued, and for a waiting one no plan queued either, then `## TLDR` and `## Why it matters`; `Priority:` is a bare whole number from 0 to 10, anything else queues at 5.
- **The claim format** - `tickets/<DATE>_<SLUG>.lock.md`, one line, `CLAIMED: <holder>`, written by `claim`, removed by `release` or `close`.
- **The plan format** - `tickets/<DATE>_<SLUG>.plan.md`: `Effort:` and `Uncertainty:` on a 0 to 10 scale, an optional `Outdated: yes`, a `# [Plan]` title, a one-sentence description and free sections; the uncertainty counts significant alternatives and decides whether a human is needed.

## Business logic

### Where the tickets are and how to reach them

#### Context

See `## Context`.

#### Business logic

The agent is told that the tickets (`tickets/<DATE>_<SLUG>.md`, with their `.plan.md` and `.lock.md` siblings) live on the branch `agent-data` [7], never on a code branch, and that a `tickets` link at the repository root, if present, is a possibly stale copy it must never write to. It reads and changes them with the `tickets` command, a dependency of the repository (`@gemstack/skill-tickets`): with no `node_modules` it first installs with the lockfile's package manager (`npm install` for `package-lock.json`), then runs `npx tickets`. It is told that every change the command makes is one commit pushed straight to the `agent-data` branch, and never to pass `--local` or `--force`, which are a person's.

### How the command answers, and how a ticket is named

#### Context

**Problem**: the agent parses the command's output and names tickets from queue entries; it must know the one shape every answer takes and the two spellings of a ticket's name, and nothing else about the command's internals.

#### Business logic

Every command prints one JSON document; a refusal is `{"ok":false,"reason":…}` on stdout, the reason in words on stderr, exit 1; a wrong command line prints the usage on stderr and nothing on stdout, exit 2. The refusal reasons themselves are not listed: the stderr line says what happened. Every `<file>` takes a ticket's filename (`2042-01-01_some-ticket.md`) or the `tickets/…` path a queue entry [6] links to; `put` also takes the ticket's `.plan.md` and `meta.json`.

### Reading

#### Context

See `## Context`.

#### Business logic

`npx tickets list` gives every open ticket as one JSON array, each row with file, title, summary, date and planned, and when set priority, topics, issue, pr, waiting, effort, uncertainty, outdated, locked and lockedBy; a set pr means the ticket is in review, a set waiting names what it waits on. `npx tickets show <file>` gives one ticket: its text, its plan, and who holds it. `npx tickets meta` gives when the tickets last caught up with the issue tracker, `{"lastImportedAt": <ISO 8601>}`, or `{}` when no import was recorded.

### Changing

#### Context

**User story**: the agent updates a ticket, writes its plan, records an import time, and closes a ticket that is not wanted; the tracker update closes one whose pull request merged.

#### Business logic

`npx tickets put <file>` writes one whole file under `tickets/` from stdin, creating it if new; the agent is shown the shape `npx tickets put <file> < draft.md`, for a ticket, its plan, or `meta.json` holding the object `meta` shows. `npx tickets close <file>` is for a ticket that is not wanted, or for the tracker update once its pull request merged: it removes the ticket with its plan and claim [3], is refused while someone else holds the ticket, and leaves the ticket's queue entry [6], if any, in place for the agent to `npx queue done`.

### Claim before planning or working

#### Context

**Problem**: two agents, possibly on different machines, may pick the same ticket; the claim [3] is what keeps them apart, and among agents only the holder lifts its own; a person can lift any.

#### Business logic

Before planning or working a ticket the agent runs `npx tickets claim <file>`: `{"ok":true,"file":…,"holder":…,"earlier":[…]}` means the ticket is the agent's, and `earlier` lists who claimed it before, newest first, each a run's id or a branch [8]: the agent reads what they did before it starts, so it neither repeats an earlier failure nor redoes work already done; `{"ok":false,"reason":"claimed","holder":…}` means it is someone else's, and the agent then picks another ticket and never removes or overwrites their claim. `npx tickets release <file>` lifts the agent's own claim when the plan or the work is done, and before the agent stops unless it closed the ticket, because nothing lifts a claim on a timeout. `put` ignores claims. The agent claims as `AGENT_ID` when it is set and not blank, else as its current branch [8], so it must release from the branch it claimed on, or the claim stays until a person lifts it.

### Queueing a ticket

#### Context

**Business logic story**: the tickets never touch the agent queue [2]; the link between a ticket and its queue entry is written and read by the queue's users, so the skill tells the agent how to write it.

#### Business logic

When the repository has the `queue` skill [5], a ticket goes on the agent queue as a link, the ticket's title as the label, at the ticket's own `Priority:`, or 5 when it has none: `npx queue add "[<title>](tickets/<file>)" --priority <N>`. Once the work is committed and its pull request is open, the agent runs `npx queue done` with the entry's exact text, writes the pull request into the ticket as its `PR:` line by `put` of the whole ticket with the line added above the title, and releases its claim; the ticket is in review. The agent does not close it: the ticket closes when the pull request merges, through the update from the issue tracker, which reads the line `Closes tickets/<file>` in the pull request's body; the agent adds `Closes #<number>` when the ticket has an issue.

### The ticket format

#### Context

**User story**: the user reads every ticket the same way, in the dashboard and in the files, and the agent queue [2] places a ticket by its priority.

#### Business logic

A ticket is `tickets/<DATE>_<SLUG>.md`, `<DATE>` as `yyyy-mm-dd` and `<SLUG>` a succinct kebab-case slug of the title. Above the `# ` title stand the optional keys: `Priority:` from 0 to 10 (10 is critical, act immediately; 0 is only if capacity), `Topics:` as a bracketed list, `Issue:` as a markdown link to the issue the ticket tracks, `PR:` as a markdown link to the pull request that closes it, and `Waiting:` as free text naming what the ticket waits on before anyone can work it. Then the title, a `## TLDR` section, a `## Why it matters` section, and optionally more under any heading. A ticket with a `PR:` line is in review: skipped when choosing work and never queued while the line stands; removing the line has it worked again. A `Waiting:` line names what the ticket waits on outside the work: the ticket is skipped when choosing work, and neither it nor a plan for it queued while the line stands; only a person removes the line, when the wait is over. `Priority:` is a bare whole number from 0 to 10 above the `# ` title; anything else queues at 5.

### The claim format

#### Context

See `## Context`.

#### Business logic

A claim [3] is `tickets/<DATE>_<SLUG>.lock.md`: one line, `CLAIMED: <holder>` [8], written by `claim` and removed by `release` or `close`.

### The plan format

#### Context

**User story**: a planned ticket carries how it will be implemented and how sure the planner is, so the user, or a routine, can tell which tickets need a human before an agent implements them.

#### Business logic

A plan is `tickets/<DATE>_<SLUG>.plan.md`. Above its `# [Plan] <ticket title>` heading stand `Effort:` from 0 to 10 (0: trivial, 10: takes months), `Uncertainty:` from 0 to 10 (0: no meaningful alternatives, 10: highly uncertain how to implement), and optionally `Outdated: yes`, when the ticket changed in a way that makes the plan outdated. Below the heading comes one sentence saying what the file holds, then optional sections: `## Problems` (what is uncertain to implement, and why), `## Solutions` (ways to solve each problem, shortcuts included), `## Considerations` (everything to weigh, edge cases included), `## Implementation` (the concrete plan), and more under any heading. `Effort:` and `Uncertainty:` are bare whole numbers above the title, else absent. The uncertainty counts significant alternatives, not variability like syntax, and decides whether a human is needed before the work: 0 means clearly not.
