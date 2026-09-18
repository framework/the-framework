The `market-research` command skill: a skill file the coding agent's harness expands from `/market-research`, the prompt of the agent a person starts for researching the market of the project's product and writing a ticket for each opportunity no ticket covers yet. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a person types `/market-research`. The agent learns what the product does, researches who else solves the same problem and what their users ask for, with a source for every outside fact, writes a ticket for each opportunity not already built and not covered by an open ticket, and ends on the research and the list of tickets it wrote.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an agent nobody answers cannot infer from the skills alone.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **The product first** - its README, documentation, user-facing surfaces and open tickets.
- **The market** - who else solves the same problem, how, for whom, at what price; what their users ask for; where the product stands out and falls short; a source for every fact from outside the project.
- **Tickets** - one new ticket per opportunity not already built and not covered by an open ticket; nothing else is changed.
- **The written result** - the last message: the research, then the tickets written.
- **No ticketing system** - it shows an error to the user and stops; in capability words, naming no skill.
