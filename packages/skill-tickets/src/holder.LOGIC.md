Decides who a ticket claim [1] names — the holder [2] — from where the `tickets` command runs, so an agent claims a ticket without having been told any identity.

## Context

**User story**: an agent runs `npx tickets claim <file>` and the claim names that agent; the user sees on a ticket's row who holds it and recognizes the agent.

## Glossary

[1] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[2] holder: who a claim names: the agent's id when the daemon started the agent, else the branch the `tickets` command ran on.

## Business logic — TL;DR

- **The agent's id from the environment, when set** - the process that started the agent puts the agent's id in `AGENT_ID`, and that id names the agent for its whole life.
- **Anywhere else, the current branch** - a cloud session on its own branch or a person on a feature branch is named by the branch the command runs on.
- **A detached checkout names nobody** - with no branch and no `AGENT_ID` there is nothing to claim as, and the caller is told so.

## Business logic

### The agent's id from the environment, when set

#### Context

**Problem**: an agent's branch is renamed as soon as the agent names its work, so a claim that named the branch would go stale at the first rename and its lock file would name a holder [2] no agent can be matched to. The environment is the one channel every process that starts an agent already controls, and reading it costs no git call.

#### Business logic

When the environment carries `AGENT_ID` with a non-blank value, the holder [2] is that value. A blank or whitespace-only value counts as unset.

### Anywhere else, the current branch

#### Context

See `## Context`.

#### Business logic

Without `AGENT_ID`, the holder [2] is the name of the branch the checkout containing the current directory is on. A cloud session working on its own branch and a person on a feature branch are both named by that branch.

### A detached checkout names nobody

#### Context

See `## Context`.

#### Business logic

A checkout on no branch at all, with no `AGENT_ID`, yields no identity: the caller is told so ("no identity") rather than handed a made-up name.
