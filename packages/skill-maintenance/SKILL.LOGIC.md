The `maintenance` command skill: a skill file the coding agent's harness expands from `/maintenance`, the prompt of the agent a person starts for finding the parts of the code that need refactoring and putting their maintainability and security work on the agent queue; it only queues. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a person types `/maintenance` and, optionally after it, the part of the project to look at. The agent splits the part into subsets that each make sense to work on alone and, for each one that needs it, puts two entries on the agent queue at a low priority: a maintainability refactor and an exhaustive security audit of that subset. Agents that work the queue do the work later.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an agent nobody answers cannot infer from the skills alone.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **The part** - what follows the slash command, a folder, a file or a feature in words; the whole project when nothing follows it.
- **Two entries per subset** - a maintainability refactor and an exhaustive security audit, each entry naming its subset and saying the whole job in words, since the agent that works it reads only the entry; usually at a low priority.
- **Already queued** - a subset whose work is already on the queue is skipped.
- **Only queue, never do** - the queue is the only thing it changes; a write rejected because someone else wrote first is tried once more after reading again.
- **Nothing needs refactoring** - it says so and stops.
- **No AI queue** - it shows an error to the user and stops; in capability words, naming no skill.
