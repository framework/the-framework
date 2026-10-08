The `ux` command skill: a skill file the coding agent's harness expands from `/ux`, the prompt of the agent a person starts for reviewing every UI flow of a part of the product, rating its user experience and improving the badly rated flows, published as far as whoever started the agent said. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a person types `/ux` and, after it, the part of the product to review. The agent lists every UI flow of the part, rates each from 0 (unusable) to 10 (perfect) with a reason, improves the flows with a bad rating, one commit per flow, and publishes the work as far as the person said when starting it: with "Open PR" picked in the launcher's publish menu, it opens a pull request whose body is the list again with each old and new rating and the commits; with nothing said, the work stays committed on its branch and the list is its last message.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an agent nobody answers cannot infer from the skills alone. The skill names no publish level: how far the work is published is said by whoever started the agent (the launcher's publish menu, for one; the runner tells the agent the level in one sentence after its prompt), and the skill says to follow it.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **The part** - what follows the slash command, a folder, a file or a feature in words; the whole project when nothing follows it.
- **Every flow rated first** - before any change, every UI flow of the part listed and rated from 0 to 10 with a reason; mostly 10s is called lazy.
- **One commit per flow** - only the badly rated flows are improved.
- **Publishing** - each change committed on the agent's branch; then the work is published as far as whoever started the agent said, and nothing is published when they said nothing. A pull request's body and the last message are the list again, old rating, new rating, and the commits of each flow.
- **Nothing to improve** - it says so with the ratings and stops, publishing nothing.
