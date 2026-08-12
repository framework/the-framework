Before the model is called, remembered facts relevant to the user's latest message are woven into the agent's instructions.

## TLDR

- The user's current message is the recall query; matching facts are prepended to the system prompt inside a clearly marked memory block.
- An optional token budget keeps the highest-confidence facts that fit and drops the rest.
- Skips silently whenever there is nothing sensible to do: no memory store registered, no user message (continuation calls), or no matching facts.

## Rationales

- The marked block tells the model these lines come from the framework rather than the agent's author, and gives downstream tooling a stable hook to detect or strip injected memory.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
