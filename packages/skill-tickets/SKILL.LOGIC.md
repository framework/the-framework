The instructions every agent [1] reads before touching a ticket: where the tickets live, how to read and change them with the `tickets` command, how to claim a ticket so no two agents work the same one, how to put one on the agent queue [2], and the three formats, a ticket, a claim [3] and a plan. Linked into the agent's checkout [4] where the coding agent's harness looks for skills, it is what turns the command into a skill [5].

## Context

**User story**: an agent starting on a task finds the project's roadmap in its tickets, picks one it may work, claims it, plans or implements it, and hands the ticket's bookkeeping back in a state the user and the next agent can trust: a claim lifted, a ticket closed once merged, a queue entry [6] removed.

**Business logic story**: everything the skill says the command does is enforced by the rules in `src/cli.ts`; the formats are what `src/tickets.ts` parses and `src/names.ts` judges; the daemon queues and claims tickets by the same rules with code of its own.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[3] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`), a command on the agent's PATH, and an API the product calls.
[6] queue entry: an item on the agent queue.
[7] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[8] holder: who a claim names: the agent's id when the daemon started the agent, else the branch the `tickets` command ran on.

## Business logic — TL;DR

- **Where the tickets are and how to reach them** - tickets live on the `agent-data` branch, never on a code branch; the root `tickets` link is a possibly stale copy never to be written; the agent installs the repository's dependencies if needed and runs `npx tickets`, whose every change is one commit pushed straight to the branch.
- **Reading** - `list` gives every open ticket as one JSON array of rows; `show <file>` gives one ticket with its text, its plan and who holds it.
- **Changing** - `put <file>` writes one whole file under `tickets/` from stdin, a ticket or a plan; `close <file>`, only once the work is merged, removes the ticket with its plan and claim, refused while someone else holds it, and leaves its queue entry to `npx queue done`.
- **Queueing a ticket** - with the `queue` skill present, a ticket goes on the agent queue as a markdown link labeled with its title, at the ticket's own `Priority:` (5 when it has none).
- **Claim before planning or working** - `claim <file>` makes the ticket the agent's or names who holds it; on someone else's the agent picks another and never removes or overwrites their claim; `release <file>` lifts the agent's own claim when done and before it stops, since nothing lifts a claim on a timeout.
- **Naming a ticket, and who the agent is** - every `<file>` is a ticket's filename or the `tickets/…` path a queue entry links to; the agent claims as `AGENT_ID` when set, else as its current branch, so it releases from the branch it claimed on.
- **The ticket format** - `tickets/<DATE>_<SLUG>.md`: optional `Priority:`, `Topics:` and `GitHub:` above a `# ` title, then `## TLDR` and `## Why it matters`; the numeric keys are bare whole numbers or they read as absent.
- **The claim format** - `tickets/<DATE>_<SLUG>.lock.md`, one line, `CLAIMED: <holder>`, written by `claim`, removed by `release` or `close`.
- **The plan format** - `tickets/<DATE>_<SLUG>.plan.md`: `Effort:` and `Uncertainty:` on a 0 to 10 scale, an optional `Outdated: yes`, a `# [Plan]` title, and free sections; the uncertainty gauges significant alternatives and decides whether a human is needed.

## Business logic

### Where the tickets are and how to reach them

#### Context

See `## Context`.

#### Business logic

The agent is told that the tickets (`tickets/<DATE>_<SLUG>.md`, with their `.plan.md` and `.lock.md` siblings) live on the branch `agent-data` [7], never on a code branch, and that a `tickets` link at the repository root, if present, shows a possibly stale copy it must never write to: the command reads fresh. It reads and changes them with the `tickets` command, a dependency of the repository (`@gemstack/skill-tickets`): with no `node_modules` it first installs with the lockfile's package manager (`npm install` for `package-lock.json`), then runs `npx tickets`. It is told that every change the command makes is one commit pushed straight to the `agent-data` branch, that a refusal exits 1 with a line on stderr, and that a wrong command line exits 2 with the usage.

### Reading

#### Context

See `## Context`.

#### Business logic

`npx tickets list` gives every open ticket as one JSON array, each row with file, title, summary, priority, topics, github, date, planned, effort, uncertainty, locked and lockedBy, where priority, topics, github, effort, uncertainty, locked and lockedBy are absent when unset. `npx tickets show <file>` gives one ticket: its text, its plan, and who holds it.

### Changing

#### Context

**User story**: the agent updates a ticket, writes its plan, and closes the ticket once its pull request is merged.

#### Business logic

`npx tickets put <file>` writes one file under `tickets/` from stdin, the whole file, creating it if new, and empty stdin writes an empty file; the agent is shown the shape `npx tickets put <file> < draft.md` for a ticket or a plan. `npx tickets close <file>` is for once the work is merged: it removes the ticket with its plan and claim [3], is refused while someone else holds the ticket, and leaves the ticket's queue entry [6], if any, in place for the agent to `npx queue done`.

### Queueing a ticket

#### Context

**Business logic story**: the tickets never touch the agent queue [2]; the link between a ticket and its queue entry is written and read by the queue's users, so the skill tells the agent how to write it.

#### Business logic

When the repository has the `queue` skill [5], a ticket goes on the agent queue as a link, the ticket's title as the label, at the ticket's own `Priority:`, or 5 when it has none: `npx queue add "[<title>](tickets/<file>)" --priority <N>`. Once the work is merged, the agent runs `npx tickets close <file>` and then `npx queue done` for the entry.

### Claim before planning or working

#### Context

**Problem**: two agents, possibly on different machines, may pick the same ticket; the claim [3] is what keeps them apart, and only the agent itself can lift its own.

#### Business logic

Before planning or working a ticket the agent runs `npx tickets claim <file>`: `{"ok":true,"file":…,"holder":…}` means the ticket is the agent's; `{"ok":false,"reason":"claimed","holder":…,"file":…}` means it is someone else's, with no holder when the claim's line does not parse, and the agent then picks another ticket and never removes or overwrites their claim. The agent is told that a claim guards `claim`, `close` and `release`, while `put` overwrites whoever holds the ticket. `npx tickets release <file>` lifts the agent's own claim when the plan or the work is done, and before the agent stops unless it closed the ticket, because nothing lifts a claim on a timeout.

### Naming a ticket, and who the agent is

#### Context

See `## Context`.

#### Business logic

Every `<file>` takes a ticket's filename (`2042-01-01_some-ticket.md`) or the `tickets/…` path a queue entry [6] links to; `put` also takes that ticket's `.plan.md` name, and writes a plan for a ticket that does not exist without complaint, invisible to `show`. The agent claims as `AGENT_ID` when it is set, else as its current branch, so a rename or a branch switch between claim and release changes who it is: it must release from the branch it claimed on, or the claim [3] stays until a person edits the branch.

### The ticket format

#### Context

**User story**: the user reads every ticket the same way, in the dashboard and in the files, and the agent queue [2] places a ticket by its priority.

#### Business logic

A ticket is `tickets/<DATE>_<SLUG>.md`, `<DATE>` as `yyyy-mm-dd` and `<SLUG>` a succinct kebab-case slug of the title. Above the `# ` title stand the optional keys: `Priority:` from 0 to 10 (10 is critical, act immediately; 0 is only if capacity), `Topics:` as a bracketed list, and `GitHub:` as a markdown link to the issue. Then the title, a `## TLDR` section, a `## Why it matters` section, and optionally more, under any heading and in any format. `Priority:`, `Effort:` and `Uncertainty:` are bare whole numbers above the `# ` title; anything else reads as absent for queue placement and the scales, and a ticket with no readable `Priority:` queues at 5.

### The claim format

#### Context

See `## Context`.

#### Business logic

A claim [3] is `tickets/<DATE>_<SLUG>.lock.md`, written by `npx tickets claim` and removed by `npx tickets release` or `npx tickets close`: one line, `CLAIMED: <holder>` [8].

### The plan format

#### Context

**User story**: a planned ticket carries how it will be implemented and how sure the planner is, so the user, or a routine, can tell which tickets need a human before an agent implements them.

#### Business logic

A plan is `tickets/<DATE>_<SLUG>.plan.md`, the plan for an existing ticket of the same stem. Above its `# [Plan] <ticket title>` heading stand `Effort:` from 0 to 10 (0: the implementation is trivial, 10: it takes months), `Uncertainty:` from 0 to 10 (0: an implementation without meaningful alternatives, 10: highly uncertain how to implement), and optionally `Outdated: yes`, only when the ticket was updated in a way that makes the plan outdated. Below the heading comes a single sentence describing the file's content, then optional sections the agent may use or replace with any headings and format: `## TLDR`, `## Problems` (every significant aspect with low confidence on how to implement, with why), `## Solutions` (for each problem, ways to solve it, meaningful shortcuts included), `## Considerations` (an exhaustive list of significant aspects, edge cases included), `## Implementation` (the concrete plan). The plan covers both spiking (high-level research without an implementation plan) and planning (a concrete proposal), and may be modified repeatedly over an extended period, such as a ticket needing repeated human intervention. The uncertainty value gauges whether there are significant alternatives, ignoring minor variability such as syntax, and is used to evaluate whether human intervention is needed: 0 means clearly none. To gauge it, the agent lists every aspect to consider, rates each from 0 (an obviously optimal way to implement it) to 10 (highly unclear whether it can be implemented better), and explores and suggests alternatives for each aspect with a low rating.
