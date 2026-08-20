Composes, in one place, the entire system channel every agent runs under, so every surface agrees on exactly what it was told.

## Flows

- Fixed order: the project context (goal, knowledge docs, tickets, queue — with the ticket and queue format specs inlined into the channel itself), then the built-in prompt, then the user's own instructions, then the emit protocols, signal protocol always last.
- Vanilla mode drops everything framework-authored but keeps the emit protocols — the agent still has to be able to signal. Transparent mode is the master off-switch: an empty channel, the agent runs raw.
- An agent with a real browser is told it has one; a hands-off agent is told the ask-gates are unavailable, so it takes its most plausible reading instead of parking on a question nobody can answer.

## Rationales

- The ticket and queue format specs travel inlined in the channel because a pointer to a file the agent may not have leaves the formats unfollowable.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
