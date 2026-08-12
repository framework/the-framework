Distills a run's event stream into the dashboard's summary cards: the review loop's status, the deploy plan, the run's lifecycle progress, what it will do with its work when it ends, and the agent session behind it.

## TLDR

- Pure folds over the same events the log renders, so a live dashboard and a replay of a past run always show the identical summary.
- Latest wins throughout: the agent may rename its session, re-decide the deploy, or re-arm its handoff mid-run.
- The publish state reads as armed (push and pull request) even for a stream that never says so, because that is what such a run will actually do; merging is the opposite — opt-in, so silence reads as off.
- A stored snapshot can seed the publish state for a viewer who attached after the run's opening events, but an event in the stream always wins over it.
- The session's workspace comes from the events rather than the disk: a finished run's working copy is deleted, and the event is the surviving record of where the conversation lived — which resuming it needs.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
