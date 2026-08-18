Decides which cloud sessions the browser extension should keep a tab open for: the few most recent web agents that carry a cloud session.

## Rationales

- Recency is the whole filter because a web agent's recorded status says nothing — every one reads as finished the moment it hands off to the cloud — so "recent, and not many" is the honest rule.
- The list is capped and deduplicated: a browser that quietly accumulates tabs is worse than a bridge that misses an old agent.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
