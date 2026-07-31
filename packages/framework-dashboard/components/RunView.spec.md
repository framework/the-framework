One session's view, running or finished (#1026): a stable frame (action bar + disclosure + notices + feed + composer) whose contents change with `live`/`working` instead of remounting.

## TLDR

- Replaced the old RunLive/RunReplay pair: swapping components at status flip remounted everything (bar blanked, feed showed "Loading session…", composer rebuilt) at the exact moment the user is most likely reading.
- Event source: while live, the channel's `events`; once ended, the archived log (`onRun`) is read and swapped in *behind* the events already on screen (`shown = live ? events : archived?.length ? archived : events`) so nothing blanks. An empty archive counts as not-there-yet (#1383): `onRun` answers `[]` for "not archived yet" as well as "gone", and a Stop races the archive write — swapping to that `[]` blanked a populated feed to "This session has no events." until refresh.
- `working = live && !agentSettled(events)` — the agent still working is NOT the run process being up (#1173): a settled session parks on the user but stays alive for messages (#785/#714), so its status reads `running` indefinitely; keying the handoff off `live` showed arming checkboxes forever.
- Bar summary swaps once: live counts (`ChangesSummary` fed by `RunChanges.onSummary`) → handoff summary, only after `handoff.loaded` (#1030, no blank beat); auto-handoff failures surface in the bar (#1102) since the returning buttons alone look like nothing was tried.
- Bar `actions`: `HandoffArm` while working, `HandoffActions` after — preceded by `ResumeButton` (#1391) when the run ended stopped (`runOutcome(shown).stopped`) AND reported a session id (`sessionInfo(shown).sessionId`, #1322): Stop is pause semantics, so a paused session's next step is offered as a button, not just the composer's hint.
- Handoff (`useRunHandoff`) is enabled once the agent stops (`!working`), not once the process dies: a parked session's branch is finished work (#1023); `armed = handoffState(shown)` folds from events so boxes read right even for a tab opened mid-run.
- Loop verdict is folded here and handed *up* via `onLoopStatus` for the right rail to pin — reported keyed by VALUE (`loopKey` string) because the fold rebuilds the object every render; cleared on unmount so the rail doesn't keep one run's verdict over the next.
- Target-specific notices: `ActionsRunNotice` (#1053 burst replay), `CloudRunNotice`/`CloudMirrorRow` tail (#610/#1265 web runs), `RemoteRunNotice` (#1067 — diff/handoff relay to the device, only the browser preview stays local).
- Finished feed is static: `stick: false, openAt: 'end'` (outcome/spend/last changes live there, #948); empty-finished says "This session has no events."; `!live && archived === null` shows "Loading session…" (waiting ≠ loading).
- `onRetainedWorktrees` (#737) drives the Remove-worktree affordance for failed/stopped runs; `removed` local state hides the button without a refetch.

## Facts

- `RunChanges` is only mounted while `working && runId` — without an id the read falls back to the project root and would report the user's own dirty files as the run's.
- `label ?? progress.sessionName` leads the bar as the stable identity, so the branch renaming near run end (#736) reads as a detail changing.
- Composer gets `sessionId`/`driver` from `sessionInfo(shown)` and `outcome` (via `runOutcome`) only when not live.

## Flows

- run ends: `live` flips → `onRun` read → `shown` swaps to archived behind on-screen events → `working` false → handoff read fires → bar summary/actions swap → feed goes static at end
- disclosure: bar toggle → `SessionDetails` + (`RunChanges` | `RunHandoffDetails`)
- loop verdict: `loopStatus(shown)` → `onLoopStatus(loop)` on value change → RightRail pins it → cleared on unmount
- `armedDefault` (#1376): the armed handoff pair from the run record, seeded into `handoffState` — the opening `handoff-armed` event predates the live channel's attach, so without the record's mirror a push-only session shows a ticked "Open PR".
