The `suggest-new-tickets` command skill: a skill file the coding agent's harness expands from `/suggest-new-tickets`, the prompt of the agent a person starts for suggesting new tickets for the project and writing each one. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a person types `/suggest-new-tickets`. The agent reads the project and its open tickets, writes a new ticket for each piece of work the project should do next that no open ticket covers, and lists them in its last message.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an agent nobody answers cannot infer from the skills alone.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **What it suggests** - bugs, missing pieces, cleanups worth their cost, features; nothing an open ticket already covers.
- **Tickets** - each suggestion written as a new ticket in the project's ticket format; nothing else is changed; the last message lists them.
- **Nothing to suggest** - it says so and stops.
- **No ticketing system** - it shows an error to the user and stops; in capability words, naming no skill.
