The `maintainability` command skill: a skill file the coding agent's harness expands from `/maintainability`, the prompt of the agent a person starts for refactoring a part of the code to make it as maintainable as possible, published as far as whoever started the agent said. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a person types `/maintainability` and, after it, the part of the project to work on. The agent finds the part's maintainability red flags, fixes them on its branch, and publishes the work as far as the person said when starting it: with "Open PR" picked in the launcher's publish menu, it opens a pull request listing each red flag and its fix; with nothing said, the work stays committed on its branch.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an agent nobody answers cannot infer from the skills alone. The skill names no publish level: how far the work is published is said by whoever started the agent (the launcher's publish menu, for one; the runner tells the agent the level in one sentence after its prompt), and the skill says to follow it.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **The part** - what follows the slash command, a folder, a file or a feature in words; the whole project when nothing follows it.
- **Red flags** - the agent looks for maintainability red flags in the part and fixes them.
- **Publishing** - each change committed on the agent's branch; then the work is published as far as whoever started the agent said, and nothing is published when they said nothing. A pull request's body lists each red flag found and how it was fixed.
- **Nothing found** - it says so and stops, publishing nothing.
