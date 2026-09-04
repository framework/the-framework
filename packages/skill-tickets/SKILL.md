---
name: tickets
description: Where the project's tickets and its agent queue live, how to read and change them, how to claim a ticket so no two agents work the same one, and the formats.
---

# Tickets and the agent queue

The tickets (`tickets/<DATE>_<SLUG>.md`, with their `.plan.md` and `.lock.md` siblings) and the agent queue (`TODO_AGENTS.md`) live on the branch `agent-data`, never on a code branch. Where a long-lived process keeps that branch checked out, a `tickets` link at the repository root shows them: read there if you like (it may trail what others pushed; the command reads fresh), never write there. The queue is not under that link.

Read and change them with the `tickets` command, a dependency of this repository (`@gemstack/skill-tickets`). If there is no `node_modules` yet, install the repository's dependencies once (`npm install`, or the package manager its lockfile belongs to). Then run it as `npx tickets`; with no arguments it prints the usage on stderr. Every change it makes is one commit pushed straight to the `agent-data` branch. A refusal exits 1 with a line on stderr; a wrong command line exits 2 with the usage.

## Read

```
npx tickets list                 every open ticket, as JSON: file, title, summary, priority, topics,
                                 github, date, planned, effort, uncertainty, locked, lockedBy
                                 (absent when unset)
npx tickets show <file>          one ticket: its text, its plan, who holds it
npx tickets queue                the queue's open entries, in order of work
```

## Change

```
npx tickets put <file>           write, or create, one file under tickets/ from stdin, the whole file
                                 (npx tickets put <file> < draft.md): a ticket, a plan, or meta.json
                                 (the last-import stamp the program that imports issues keeps there)
npx tickets close <file>         once the work is merged: remove the ticket with its plan and lock;
                                 refused while someone else holds it; its queue entry stays:
                                 `queue done` it
npx tickets queue add <text> [--priority N] [--ticket <file>]
                                 put an entry on the queue; --priority places it in that section,
                                 --ticket links it to the ticket and places it by the ticket's
                                 priority (5 when it has none) unless --priority says otherwise;
                                 with neither, it goes at the end of the file, in whatever section ends it
npx tickets queue done <entry>   remove an entry, exactly as `npx tickets queue` printed it: done means deleted
```

## Claim before you plan or work a ticket

```
npx tickets claim <file>         {"ok":true,"file":…,"holder":…} — the ticket is yours
                                 {"ok":false,"reason":"claimed","holder":…} — someone else's (no holder
                                 when the lock is unreadable): pick another; never remove or
                                 overwrite their lock. A claim guards claim, close and release,
                                 never put, which overwrites whoever holds the ticket
npx tickets release <file>       lift your own claim once the plan is finished or the work is published
```

Every `<file>` above takes a ticket's filename (`2042-01-01_some-ticket.md`) or the `tickets/…` path a queue entry links to; `put` also takes that ticket's `.plan.md` name. You claim as the value of `AGENT_ID` when the process that started you set it in your environment, else as your current branch name (so a rename between claim and release changes who you are).

## Formats

### A ticket: `tickets/<DATE>_<SLUG>.md`

DATE: yyyy-mm-dd. SLUG: a succinct kebab-case slug of the ticket title.

```md
Priority: 0-10 [optional, 10: critical — act immediately, 0: only if capacity]
Topics: [list-of-topics] [optional]
GitHub: [#42](https://github.com/org/repo/issues/42) [optional]

# Ticket title

## TLDR

...

## Why it matters

...

[optional: more info (any heading and format you want)]
```

A key's value is a bare whole number, above the `# ` title; anything else reads as absent, and a ticket with no readable `Priority:` queues at 5.

### A claim: `tickets/<DATE>_<SLUG>.lock.md`

Written by `npx tickets claim`, removed by `npx tickets release` or `npx tickets close`. One line: `CLAIMED: <holder>`.

### A plan: `tickets/<DATE>_<SLUG>.plan.md`

The plan for an existing ticket (`tickets/2042-01-01_some-ticket.md` → `tickets/2042-01-01_some-ticket.plan.md`).

```md
Effort: 0-10 [0: implementation is trivial, 10: implementation takes months]
Uncertainty: 0-10 [0: implementation without meaningful alternatives, 10: highly uncertain how to implement]
Outdated: yes [optional, only if the ticket was updated in a way that makes the plan outdated]

# [Plan] Ticket title

Single sentence describing this file's content.

## TLDR [optional]

Brief overview of this file's content.

## Problems [optional]

List of all significant aspects with low confidence on how to implement, with explanation why uncertain.

## Solutions [optional]

For each problem, list of ways to solve the problem (including meaningful shortcuts, for quicker implementation).

## Considerations [optional]

Exhaustive list of all significant aspects to be considered (including edge cases).

## Implementation [optional]

Concrete plan to implement the ticket.
```

Notes:
- Covers both spiking (e.g. high-level research without implementation plan) and planning (e.g. concrete implementation proposal)
- The `.plan.md` file can be modified multiple times over an extended period (e.g. a ticket requiring repeated human intervention, transitioning from spiking to concrete plan)
- All sections are just proposals and optional: you can use any headings with any format
- The uncertainty value:
  - Gauges whether there are *significant* alternatives, minor variability such as syntax should be ignored
  - Is used for evaluating whether human intervention is needed (0 => clearly no human intervention needed)
- Example of how to gauge uncertainty and alternatives:
  - List all aspects that need to be considered
  - Give an uncertainty rating (0-10) to each aspect following this criteria: is there an obviously optimal way to implement it (0), or is it highly unclear whether it can be implemented in a better way (10)?
  - Explore and suggest alternatives for each aspect with a low rating

### The queue: `TODO_AGENTS.md`

```md
## Priority 10 (critical — act immediately)

...

## Priority 9

- [Succinct description](/link-for-more-details)
- Or self-contained TODO item with complete description of what should be done

...

## Priority 0 (only if capacity)

...
```

The queue lists *all* tasks AI will work on next, sorted by priority. Priority 10 is rarely used (e.g. critical production bugs) and is treated as the utmost priority. Within a priority, the first tasks have higher priority (they are the "next" tasks within that "priority queue"). A done entry is removed (`npx tickets queue done`).
