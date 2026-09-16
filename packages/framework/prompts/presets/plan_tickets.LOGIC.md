The "Plan tickets (aka spike)" preset of the launcher: the agent [1] picks the 10 most important tickets that have neither a plan [3] nor a claim [4] and puts one entry per ticket on the agent queue [2] asking for that ticket's plan to be written, each with a priority it chooses after reading the ticket. Its tooltip reads "Turn `tickets/*.md` into costed plans (`tickets/*.plan.md`)". It takes no parameter: it scopes itself to the project's own tickets. The planning itself is done by the agents that later work those entries, not by this one.

## Context

**User story**: the user's tickets get costed plans, effort and uncertainty rated and an implementation sketched, without anyone asking for them one by one; the cheap-looking tickets are planned first, and a ticket already planned or already being worked is left alone.

**Business logic story**: one agent runs the prompt as written and only queues the planning work; the agents that later work those entries write the plans.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[3] plan: a ticket's `.plan.md`: effort and uncertainty ratings and how to implement it.
[4] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[5] skill: one of the four capabilities an agent is taught (`branches`, `tickets`, `queue`, `logs`), each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.

## Business logic — TL;DR

- **Pick the 10 most important unplanned, unclaimed tickets** - from `tickets list` of the `tickets` skill [5], the agent takes at most 10 tickets that are neither planned nor locked, the most important first.
- **Queue one plan per ticket** - for each, it adds `Create tickets/<TICKET>.plan.md` to the agent queue with `queue add ... --priority <N>` from the `queue` skill.
- **Priority from reading the ticket** - each entry's priority follows a mix of sensible criteria after reading the ticket with `tickets show`; for instance, a ticket that seems low effort gets a higher priority.
