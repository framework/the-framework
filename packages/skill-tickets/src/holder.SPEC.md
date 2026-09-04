Who a claim is made under, read from where the command runs — nothing for the agent to type or know.

## User story

- An agent claims a ticket and the claim names the agent, without the agent having been told any identity.
- The user sees who holds a ticket and recognises the session.

## Business logic — TL;DR

- **`AGENT_ID` from the environment, when set** - the process that started the agent puts the agent's id there, and the id names the agent for its whole life.
- **Anywhere else, the current branch name** - a cloud session on its own branch, a person on a feature branch.
- **A detached checkout names nobody** - there is nothing to claim as, and the caller is told so.

## Business logic

### `AGENT_ID` from the environment, when set

#### User story

See `## User story`.

#### Business logic

When the environment the command runs in carries `AGENT_ID`, the holder is that value: the process that started the agent set it to the agent's id.

#### Rationale

The id names the agent for its whole life, whereas the branch is renamed once the agent names its session: a claim naming the branch would go stale at the first rename, and the lock file it wrote would name a holder nobody can be matched to any more. The environment is the one channel every process that starts an agent already controls, and it costs no git call.

### Anywhere else, the current branch name

#### Business logic

Without `AGENT_ID`, the holder is the name of the branch the checkout is on: a cloud session working on its own branch, or a person on a feature branch.

### A detached checkout names nobody

#### Business logic

A checkout on no branch at all, and no `AGENT_ID`, yields no identity, and the caller is told that rather than being given a made-up name.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
