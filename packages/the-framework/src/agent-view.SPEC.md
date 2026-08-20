Distills an agent's event stream into the dashboard's summary cards: the agent's lifecycle progress, what it will do with its work when it ends, and the agent session behind it.

## Flows

- Pure folds over the same events the log renders, so a live dashboard and a replay of a past agent always show the identical summary.
- Latest wins throughout: the agent may rename its session or re-arm its handoff at any point.
- The publish state reads as armed (push and pull request) even for a stream that never says so, because that is what such an agent will actually do; merging is the opposite — opt-in, so silence reads as off.
- A stored snapshot can seed the publish state for a viewer who attached after the agent's opening events, but an event in the stream always wins over it.
- The workspace comes from the events rather than the disk: a finished agent's working copy is deleted, and the event is the surviving record of where the conversation lived — which resuming it needs.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
