Priority: 2
Topics: [enhancement, the-framework]
GitHub: [#1117](https://github.com/gemstack-land/the-framework/issues/1117)

# Record the ticket a run starts from, for a true 'implementing' status

## TLDR

The "Hot tickets" overview (#1112) infers its **In progress** lane from a ticket's `.plan`/`.spike` sibling because `RunMeta` carries no ticket reference — there is no link between a run and the ticket it implements. The pipeline loses ticket identity when a ticket is promoted into the plain-text `TODO_AGENTS.md` queue, so the link needs either the queue item to carry the ticket's slug through to the run, or a dedicated "start a run for this ticket" entry point that records it. Optional / post-MVP.

## Why it matters

With the link in place, the Hot tickets card can show a truthful `implementing · live` state for tickets with a live run, instead of the planned-or-spiked approximation. Deliberately low priority: the proxy is acceptable for now.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1117](https://github.com/gemstack-land/the-framework/issues/1117), created 2026-07-24, labels: `enhancement`, `priority: low`, `the-framework ♻️`.

### Original description

## Follows #1112

The "Hot tickets" overview added in #1112 has an **In progress** lane. Today it infers a ticket is being worked from its `.plan` / `.spike` sibling. There is **no link between a run and the ticket it is implementing**, so a ticket being coded right now does not show as "implementing".

## What is missing

`RunMeta` carries no ticket reference. To show a true `implementing · live` state, a run needs to record the ticket it started from.

## Wrinkle

The pipeline loses ticket identity along the way: a ticket is promoted into the plain-text queue (`TODO_AGENTS.md`), and the loop works text items. So the link needs one of:

- the queue item to carry the ticket's slug through to the run that picks it up, or
- a dedicated "start a run **for this ticket**" entry point that records the ticket.

## Outcome

With the link in place, the Hot tickets card can mark a ticket that has a live run as **implementing**, instead of approximating it via plan/spike.

## Priority

Optional / post-MVP — the planned-or-spiked proxy is acceptable for now.
