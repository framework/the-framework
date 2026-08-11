Drives a chain of agent-to-agent handoffs to completion, merging every hop into one final answer.

## TLDR

- When an agent hands off, the next agent picks up the full conversation so far — under its own instructions — and runs; if it hands off too, the chain continues.
- Steps and token usage from every hop are merged into the final response, along with the ordered list of agents the conversation passed through.
- A hard cap on hops turns agents that hand off in circles into a clear error instead of a token-burning loop.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
