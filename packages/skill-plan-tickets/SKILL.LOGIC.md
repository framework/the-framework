The `plan-tickets` command skill: the prompt of the agent a runner starts for queueing a plan for every open ticket that has none, as a skill file the coding agent's harness expands from `/plan-tickets`. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a runner starts an agent with `/plan-tickets`. The agent reads every open ticket, takes the ten most important among those neither planned nor held by someone, and puts one entry per ticket on the agent queue asking for that ticket's plan, each at a priority it picks after reading the ticket. It writes no plan itself; the queued work does.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an unattended agent cannot infer from the skills alone. Where the job is broken without a capability, the skill says so in capability words and stops.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **Which tickets** - open, not planned, not held by someone; the ten most important of them.
- **One entry per ticket** - an entry on the agent queue asking for that ticket's plan to be written, naming the ticket's file, at a priority picked after reading the ticket by a mix of sensible criteria, a low-effort-looking ticket ranking higher; a ticket whose plan is already asked for on the queue is skipped, and so is a ticket in review (one with a pull request named on it).
- **A rejected write** - a write to the queue rejected because someone else wrote first is tried once more after reading again.
- **Only queue** - it writes no plan itself.
- **Nothing to plan** - it says so and stops.
- **No ticketing system, no AI queue** - it shows an error to the user and stops; in capability words, naming no skill.
