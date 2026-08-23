The file format every agent must follow when it reads or writes tickets: how a ticket file is named and structured, how an agent claims one so two agents never work the same ticket, and what a ticket's plan contains — including the effort and uncertainty ratings that decide whether a ticket can be worked unattended.

## User story

- The user's roadmap is a folder of markdown tickets. Any agent — one triaging, one planning, one implementing — must produce files the others can read, or the roadmap stops being usable.
- The user wants unattended work to pick only the tickets that are genuinely safe to do without them. That judgement is carried by a ticket's plan, in numbers any agent can compare.
- The user starts several agents at once. Two of them picking the same ticket wastes both.

## Business logic — TL;DR

- **A ticket is one dated markdown file** - `tickets/<DATE>_<SLUG>.md`, with an optional priority, topics and GitHub issue link above a title, a TLDR and a "why it matters" section.
- **`tickets/` holds only open tickets** - closing a ticket means deleting it, together with its plan and lock files.
- **A ticket is claimed by a lock file** - an agent working or planning a ticket first writes a `.lock.md` naming itself; losing the race on that file means backing off to another ticket.
- **A plan is a sibling file** - `.plan.md` beside the ticket, rated for effort and uncertainty, optionally marked outdated when the ticket has moved on.
- **Uncertainty decides whether a human is needed** - it counts only significant alternatives, and a zero says outright that no human intervention is needed.
- **A plan covers spiking as well as planning** - its sections are proposals, and the same file is revised over time as a spike hardens into a concrete implementation plan.

## Business logic

### A ticket is one dated markdown file

#### User story

See `## User story`: the roadmap is only usable if every agent writes the same shape.

#### Business logic

A ticket lives at `tickets/<DATE>_<SLUG>.md`, where the date is `yyyy-mm-dd` and the slug is a succinct kebab-case form of the ticket's title.

Its body opens with three optional header lines: a `Priority` from 0 to 10 (10 meaning critical, act immediately; 0 meaning only if there is capacity), a `Topics` list, and a `GitHub` link to the issue the ticket mirrors. Below them comes the ticket title as the document's heading, a `## TLDR` section, and a `## Why it matters` section. Any further information may follow under any headings the agent likes.

### `tickets/` holds only open tickets

#### User story

The user reads the ticket folder as the list of things still to do.

#### Business logic

When a ticket is closed it is removed from the repository, and so are its `.plan.md` and `.lock.md` siblings — the folder is the set of open tickets, never an archive.

### A ticket is claimed by a lock file

#### User story

See `## User story`: two agents must never work or plan the same ticket.

#### Business logic

Whenever an agent works or plans a ticket it must create `tickets/<DATE>_<SLUG>.lock.md`, whose whole body is a `CLAIMED:` line identifying the claiming agent by its id and its session name.

The claim is settled by the push, not by the read: if pushing the lock hits a conflict on that same `.lock.md`, another agent claimed the ticket first, so the agent backs off and picks something else. Resolving such a conflict in one's own favour is forbidden outright.

#### Rationale

Making the push the moment of truth is what makes the claim safe between agents that cannot see each other: the losing agent finds out at the only point where the outcome is unambiguous, and the rule against resolving the conflict stops it from talking itself past that answer.

### A plan is a sibling file

#### User story

The user wants a ticket costed before it is worked on, so that what gets queued is chosen on evidence.

#### Business logic

A plan for an existing ticket is written beside it as `tickets/<DATE>_<SLUG>.plan.md`. It opens with two required ratings and one optional flag:

- `Effort`, 0 to 10, where 0 means the implementation is trivial and 10 means it takes months;
- `Uncertainty`, 0 to 10, where 0 means the implementation has no meaningful alternatives and 10 means it is highly uncertain how to implement;
- `Outdated: yes`, present only when the ticket has since been updated in a way that invalidates the plan.

The body opens with the ticket's title marked as a plan, then a single sentence describing the file's content. Optional sections follow: a brief overview; the significant aspects whose implementation is unclear, with the reason for each; the ways each of those could be solved, meaningful shortcuts included; an exhaustive list of significant aspects and edge cases to consider; and the concrete implementation plan.

### Uncertainty decides whether a human is needed

#### User story

Unattended work must pick only tickets whose implementation has no meaningful open decisions, because there is nobody to answer a question.

#### Business logic

The uncertainty rating gauges whether *significant* alternatives exist; minor variability such as syntax is ignored. It is what decides whether human intervention is needed, with 0 meaning clearly none.

The prompt also shows how to arrive at the number: list every aspect that has to be considered, rate each on whether there is an obviously optimal way to implement it or whether it is highly unclear that a better implementation exists, and explore and suggest alternatives for the uncertain ones.

### A plan covers spiking as well as planning

#### User story

Some tickets need a round of research before anyone can say how to implement them, and the research and the eventual plan are about the same ticket.

#### Business logic

One plan file covers both ends of that range: high-level research with no implementation plan, and a concrete implementation proposal. It may be modified repeatedly over an extended period — a ticket needing repeated human intervention transitions from spike to concrete plan inside the same file. Every section is a proposal only; an agent may use whatever headings and format suit the ticket.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
