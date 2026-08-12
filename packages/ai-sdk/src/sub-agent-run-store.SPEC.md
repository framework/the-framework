Where a paused sub-agent run's state lives between the pause and its resume — the whole inner conversation plus what it is waiting on.

## TLDR

- A snapshot records the inner conversation, the pending tool calls, progress counters, whether the pause was for browser tools or an approval (including the gated call's details so a UI can render "approve this?" without re-asking the agent), and opaque host metadata.
- Resuming consumes a snapshot exactly once — a replayed or forged id gets nothing — while an optional non-destructive read lets hosts validate ownership and context before committing to the resume.
- Two implementations ship: in-memory for tests and single-process dev, and one over any caller-supplied cache with a short default lifetime so abandoned runs clean themselves up.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
