The single event stream an agent narrates itself over: one timeline uniting the framework's own steps, the driver's progress, and the moments that need a human.

## TLDR

- The framework owns the stream rather than exposing the driver's transport, so every surface — terminal, dashboard, chat — renders the same story.
- Events are the agent's durable record: anything a dashboard tab opened later must know (the ticket being implemented, the branch, the pull request opened for the work, what the end-of-work handoff is armed to do) travels as an event, because only events reach its stored history.
- Interactive gates are events too: a choice pauses the agent until a pick is posted back, and both the question and who answered it are on the record.
- Every skipped or withheld outcome carries its reason, so "it was on and nothing happened" always has an answer in the log.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
