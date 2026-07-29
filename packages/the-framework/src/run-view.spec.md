Pure projections of the `FrameworkEvent` stream into the dashboard's overview-card state (#431), so the live dashboard and a past-run replay show the identical summary.

## TLDR

- `loopStatus()`: the review loop's latest verdict from `checklist`/`improve`/`done` bootstrap events (pass number, blockers, production-grade, finished); null until a checklist ran — a prototype build never loops, and neither does a run with no review configured (#1372): `done` with zero passes opens no status.
- `deployPlan()`: the chosen deploy plan from the latest `deploy` bootstrap event, or null.
- `runProgress()` (#326): latest `session-name` and whether `ready-for-merge` fired — drives the status label + dot (orange building, green ready).
- `handoffState()` (#1102): what the session is armed to push/PR from `handoff-armed` events (latest wins; checkboxes re-emit on change) and how the handoff ended (`handoff` event: done/skipped/failed). Takes an optional seed (#1376): the opening `handoff-armed` predates the live channel's attach, so a live tab must seed from `RunRecord.handoff` or a push-only run reads as armed for a PR.
- `sessionInfo()` (#431): driver + workspace from the opening `session` event, then id and deep link from the latest `session-update`.

## Decisions

- Kept in this package (not the dashboard) so the projections are unit-tested against the real event shapes.
- `handoffState` starts `{push: true, pr: true}`: a run from before the feature emits no `handoff-armed` and must read as armed, which is what it will actually do on new code.
- `SessionInfo.workspace` comes from the event, not the filesystem: a clean finish removes the worktree, so the event is the only surviving record of where the session lived — exactly what `claude --resume` needs (#1195).
