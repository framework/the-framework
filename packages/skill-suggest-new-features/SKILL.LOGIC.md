The `suggest-new-features` command skill: a skill file the coding agent's harness expands from `/suggest-new-features`, the prompt of the agent a person starts for thinking like a product manager and writing a ticket for each net-new feature the product should have next. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a person types `/suggest-new-features`. The agent studies what the product does and its open tickets, writes a new ticket for each net-new feature worth building that fits the product's direction, and ends on a short summary of what it proposed.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an agent nobody answers cannot infer from the skills alone.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **Net-new features only** - capabilities a user would want, not bugs, refactors or chores; nothing already built or covered by an open ticket; favouring what fits the product's direction.
- **Tickets** - each proposed feature written as a new ticket in the project's ticket format; nothing else is changed; the last message is a one-line-per-ticket summary.
- **Nothing to propose** - it says so and stops.
- **No ticketing system** - it shows an error to the user and stops; in capability words, naming no skill.
