The single event stream an agent narrates itself over: one timeline uniting the framework's own steps, the driver's progress, and the moments that need a human.

## User Stories

- The user watches one timeline per agent — the framework's steps, the driver's progress, the questions that need a human — and it reads the same in the terminal, the dashboard, and chat.
- The user opens a dashboard tab at any point and nothing is missing, because whatever a later reader must know travels as an event.
- The user always finds a reason on the record when something that was switched on did not happen.

## Flows

- The framework owns the stream rather than exposing the driver's transport, so every surface — terminal, dashboard, chat — renders the same story.
- Events are the agent's durable record: only events reach its stored history, so anything a dashboard tab opened later must know travels as an event — the ticket being implemented, the branch, the pull request opened for the work, the marker commit (hand-off anchor) a cloud run's branch is later recognized by, and what the end-of-work handoff is armed to do.
- Interactive gates are events too: a choice pauses the agent until a pick is posted back, and both the question and who answered it are on the record.
- An error the agent hit is an event on that timeline: it happened at a point in the run and stays there as history, which is why nothing ever clears it. The errors a background job finds between runs are a different thing entirely — a condition that is true of the project right now, held elsewhere and cleared the moment it is fixed.
- Every skipped or withheld outcome carries its reason, so "it was on and nothing happened" always has an answer in the log.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
