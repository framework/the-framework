Distills an agent's event stream into the dashboard's summary cards: the agent's lifecycle progress, what went wrong along the way, what it will do with its work when it ends, and the agent session behind it.

## User Stories

- The user reads an agent's card at a glance: the name it chose, and a badge that flips when the agent signals ready for merge.
- The user sees what an agent will do with its work when it ends — push, open a pull request, merge — exactly as armed.
- The user sees how many errors an agent hit and the latest of them, without reading its log.
- The user opens a past agent's record and sees the identical summary a live viewer saw.

## Flows

- The cards are pure folds over the same events the log renders, so a live dashboard and a replay of a past agent always show the identical summary.
- Latest wins throughout: the agent may rename its session or re-arm its handoff at any point. Errors are the exception — they only accumulate, because an error is something that happened and nothing can un-happen it.
- The publish state reads as armed (push and pull request) even for a stream that never says so, because that is what such an agent will actually do; merging is the opposite — opt-in, so silence reads as off.
- A stored snapshot can seed the publish state for a viewer who attached after the agent's opening events — so a session the launcher armed push-only never shows as one that will open a pull request; an event in the stream always wins over the snapshot.
- Resuming a finished agent needs to know where the conversation lived, and its working copy is deleted — so the workspace comes from the events, the surviving record, never from the disk.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
