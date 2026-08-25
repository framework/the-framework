# Bug analysis: packages/framework/src/agent-view.ts

## Business logic (high-level)

Four pure folds over an agent's `FrameworkEvent` log, producing everything the dashboard's overview
cards show. The architectural rule is that *nothing* is stored beside the events: a live agent and a
replayed finished agent must produce identical summaries, which is only true if every projection is
a deterministic function of the event prefix seen so far. All four functions are exactly that —
single forward passes, no `Date.now()`, no filesystem, no module state, no mutation of the input
(`readonly FrameworkEvent[]`). Replaying a prefix of the log yields the summary that was shown at
that moment, which is the property the SPEC's first bullet demands.

Per-projection semantics and their edge cases:

**`agentProgress` — "named, then ready".** Latest `session-name` wins (an agent may rename itself);
`ready-for-merge` is sticky-true. There is always an answer: an untouched agent is
`{readyForMerge:false}` with no name. Nothing in the event vocabulary retracts readiness, so the
sticky fold is right rather than lossy.

**`agentErrors` — "errors accumulate, oldest first".** Append-only, in stream order, `detail` carried
only when non-empty. The list can only grow, so a reopened agent shows exactly what it showed live.
An `error` event with an empty-string `detail` collapses to "no detail", which is the same rendering
either way.

**`handoffState` — "armed, then resolved".** Three armed booleans plus an optional result. The
default asymmetry is the load-bearing decision: `push`/`pr` default **on** (a stream predating the
arming event will in fact push and open a PR, so reading it as disarmed would lie in the dangerous
direction of under-promising), while `merge` defaults **off** (merging is opt-in, and silence must
never read as "this agent will land on the default branch by itself"). The `initial` seed exists
because the agent writes `handoff-armed` as its very first event, before a live tab can attach; a
stream-borne `handoff-armed` always wins over the seed because the fold applies events after the
seed. The `event.merge !== undefined` guard is what keeps a pre-#1382 arming event from silently
disarming a seeded merge — a plain assignment there would flip an armed merge off, so the guard is
necessary and correctly written (`!== undefined` rather than truthiness, so an explicit
`merge: false` still wins).

Ordering/idempotence: repeated `handoff-armed` events are last-wins; repeated `handoff` events are
last-wins too. Note one consequence, deliberate rather than wrong: a continuation leg that resumes
an agent whose handoff already ran keeps the previous leg's `result` in the projection until the new
leg emits its own `handoff` event — the log is append-only and the fold has no notion of legs for
this field, and the SPEC says the summary is a projection of the whole log.

**`sessionInfo` — "the wrapped session survives its worktree".** `null` until a `session` event
appears. A `session` event *replaces* the whole object rather than merging into it, which is what
implements "driver, workspace and model are folded per leg: the latest announcement wins, and a leg
that recorded no model clears it" — a merge would leave the previous leg's model (and its resolved
link) stuck on a leg that recorded neither. A `session-update` merges into whatever is there, so the
workspace recorded at leg start survives the later id announcement — the SPEC's explicit
requirement, since it is the *pair* (workspace + session id) that reopens the coding agent's session
after the worktree has been removed. The link precedence works out right: the opening event only
carries a link when it is literal (the template case is suppressed upstream in
`agent-telemetry.ts:31`), and `session-update` overwrites it only when it actually has one, so a
driver's real URL replaces a literal, and an id-only update never blanks an existing link.

Two consequences of the per-leg reset, both intended: a continuation leg shows no `sessionId` in the
window between its `session` event and its first `session-update` (the id genuinely is unknown
then), and a `session-update` arriving before any `session` event would produce a summary with only
an id. The latter cannot happen — `emitSessionStart` runs before the driver session starts, so the
opening event always precedes the driver's announcements in the log.

## Functions (low-level)

### `agentProgress(events): AgentProgress` (`L23`)

Empty input → `{readyForMerge:false}`. `else if` means a single event cannot be both, which matches
the disjoint event kinds. No early exit, so the *last* name wins (tested). Verdict: correct.

### `agentErrors(events): AgentError[]` (`L47`)

Empty input → `[]` (a fresh array each call, so callers cannot corrupt a shared one). Order
preserved. `detail` conditionally spread, so the returned objects deep-equal the minimal shape.
Verdict: correct.

### `handoffState(events, initial?): HandoffState` (`L85`)

- *No events, no seed*: `{push:true, pr:true, merge:false}`.
- *Seed without `merge`*: `merge` falls back to `false`, not to `true` — right, given merge is
  opt-in.
- *Seed with `merge:false` and a stream event without `merge`*: stays false. Correct.
- *`handoff` with `outcome:'done'` and no url*: `{outcome:'done'}` with the key omitted, so the UI
  can test presence rather than emptiness. Correct.
- *`handoff` before any `handoff-armed`*: result set, arming stays at the defaults. Fine — the
  outcome is what matters at that point.
- *Unknown `outcome` value*: impossible; the union is exhaustive and the final `else` branch is the
  `skipped` arm, typed to carry `reason`.

Verdict: correct.

### `sessionInfo(events): SessionInfo | null` (`L134`)

- *No session events*: `null` (tested with an unrelated `log` event).
- *`session` then `session-update`*: merged, workspace preserved (tested).
- *Two `session` events (a continuation leg)*: full replacement, so a model recorded on the earlier
  leg is cleared (tested).
- *`session` with no `sessionLink`/`model`*: keys omitted rather than set to `undefined`, so
  `deepEqual`-style consumers see a minimal object.
- *Several `session-update`s*: last id wins; a later update without a link keeps the earlier link.
  This is the one place the fold is not "latest wins" for a field, and it is right: an id-only
  announcement is not a statement that the link is gone.

Verdict: correct.

## Bugs found

None found.
