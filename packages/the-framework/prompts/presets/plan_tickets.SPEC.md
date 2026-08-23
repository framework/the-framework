The plan-tickets preset: queues planning work for the tickets that still have none. The agent picks the 10 most important tickets that have neither a plan nor a claim on them, and appends one entry per ticket to the agent queue (`TODO_AGENTS.md`) asking for that ticket's plan to be written.

## Business logic — TL;DR

- **Only unplanned, unclaimed tickets** - a ticket already carrying a plan file, or already claimed by another agent's lock file, is skipped.
- **Ten at a time** - the agent queues the 10 most important such tickets, not the whole backlog.
- **Each entry is filed by priority** - the agent reads the ticket before deciding which priority band its planning entry goes in, weighing sensible criteria such as low apparent effort earning higher priority.

## Business logic

### Only unplanned, unclaimed tickets

#### User story

The user wants every ticket costed before it is worked on, and wants repeat runs of this preset to make progress instead of re-queueing the same tickets.

#### Business logic

Eligibility is read off the ticket folder itself: a ticket qualifies only when it has no sibling plan file and no sibling lock file. The plan file means the ticket is already costed; the lock means another agent is already working or planning it. Ten of the most important qualifying tickets are queued per firing, one entry each.

### Each entry is filed by priority

#### User story

The queue is worked top-down, so where an entry lands decides when the ticket gets planned.

#### Business logic

The agent reads each ticket before placing its entry, and puts the entry in the priority band that a mix of sensible criteria suggests — for instance a ticket that looks like low effort earning a higher priority.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
