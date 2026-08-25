# Bug analysis: packages/framework/src/agent-telemetry.ts

## Business logic (high-level)

The accounting shared by both agent entry paths (a build run and a direct prompt): announce the
session, translate the driver's black-box event stream into the framework's own event log, keep the
running usage total, compose the stop signal, and classify an early ending as stopped-vs-failed.
Extracting it is what stopped the two paths from drifting (the backlog loop had lost the turn-signal
parsing entirely).

Four independent pieces:

**1. Opening announcement (`emitSessionStart`).** One `session` event carrying driver id, workspace,
`fake` flag and (when chosen) the model. The link rule is the interesting part: a *literal*
`sessionLink` is published immediately, a *templated* one (`.../{sessionId}`) is suppressed because
it cannot be resolved until the driver reports its id — publishing the unresolved template would
put a broken link in the UI. `fake` is `driver.id === 'fake'`, which matches the `DriverImplId`
union (`driver-names.ts:40`) and the fake driver's own `readonly id = 'fake'`.

**2. Driver-event translation (`createDriverEventHandler`).** Closure state: `lastSessionId` and one
`UsageMeter`. Rules:
- A `session` event (the turn-*start* id announcement, #1322) is *consumed*: it publishes a
  `session-update` when the id changed, and is never forwarded as a `driver` row. The rationale is
  in the SPEC — the id must land before a Stop or crash can lose the turn, and a transcript row
  repeating an id the next event also carries is noise.
- Every other event is forwarded as `{kind:'driver', event}`; only `result` gets extra handling.
- On `result`: publish `cloud-anchor` when the turn carries a hand-off anchor; publish a
  `session-update` when the id is new, preferring the driver's own `sessionLink` over the resolved
  template; fold usage and republish the total.

Ordering within a result is deliberate and consistent: the `driver` row first (so the transcript
shows the turn), then the facts the daemon needs after the process is gone (anchor, session id),
then usage. Nothing downstream depends on the reverse.

Idempotence/dedup: `lastSessionId` is the only dedup key, and it is updated in both branches before
emitting, so a repeated id never republishes. One consequence is worth naming, because it is where
this design could bite: **a `sessionLink` arriving on a `result` whose id was already announced at
turn start would be silently dropped**, since the emit is gated on the id changing rather than on
the link changing. Today that combination cannot occur — only `claude-code.ts:248` emits the
turn-start `session` event and its results never carry a `sessionLink`, while the only producer of
`sessionLink` (`driver/cloud.ts:256`) emits no `session` events at all, so its first `result` always
finds `lastSessionId === undefined` and publishes the real URL. So this is a latent coupling between
two driver implementations, not a present defect; a future driver that did both would lose the real
session URL. Recorded as suspicious-but-unproven rather than as a bug, per the "inputs callers
provably never produce" rule.

The cloud driver's *second* pass (`report(session,'again')`) repeats the same id and link, which is
correctly deduped — the URL was already published by the first pass.

**3. Signal composition (`createAgentControls`).** `AbortSignal.any` of the caller's signal (Stop
button / Ctrl-C / control channel) and the one remaining self-stop (a gate answer marked as
stopping). Everything downstream watches the single composed signal, so the source cannot change
behaviour. An already-aborted caller signal yields an already-aborted composite, which is the
correct degenerate case. Per E1 the two former self-stops (per-agent USD cap, mid-run quota gate)
are gone by decision, matching `MEMORY.md`'s "never interrupt a running session on low quota" —
their absence here is intentional, not a missing feature.

**4. End classification (`endStopDetail`).** `stopped = callerAborted || answered`; `detail` is
"stopped by your answer" for the answer stop and the error's own message otherwise. Shared by both
paths so they cannot disagree about what "stopped" means. Note a caller Stop produces
`stopped: true` with whatever message the abort threw — the SPEC only pins the answer-stop wording
and "a failure reports the underlying error's own message", so this is within spec.

## Functions (low-level)

### `emitSessionStart(opts: SessionStartOptions): void` (`L30`)

Inputs: emit sink, driver, cwd, optional link and model. Output: one event.

- *No `sessionLink`*: `literal` is `undefined` (the `&&` short-circuits) → key omitted. Correct.
- *Templated link*: suppressed until `session-update`. Correct per SPEC.
- *Empty-string link*: falsy → omitted, same as absent. Fine.
- *No model*: key omitted rather than sent empty — "the agent's own default is not knowable here".
  Correct.

Verdict: correct.

### `createDriverEventHandler(opts): DriverEventHandler` (`L63`)

Returns a closure over `lastSessionId` + `UsageMeter`; one handler per agent, wired as the driver
session's `onEvent`.

- *`session` with an unchanged id*: no emit, no forward. Correct (dedup).
- *`session` with a changed id*: emits `session-update` with the template resolved against the new
  id, or no link at all when no template is configured. Correct.
- *`result` without `sessionId`*: the `event.sessionId &&` guard skips the update — a driver that
  does not report ids never publishes a bogus one. Correct.
- *`result` with `anchorSha`*: emitted unconditionally (no dedup). The cloud driver emits an anchor
  on every pass, so a second pass republishes the same sha — harmless: the consumer records a fact
  about the run, and re-recording the same sha is idempotent.
- *`result` with `usage`*: `usage.add` then emit the *running total* (not the delta), matching
  "Usage totals grow turn by turn". A `result` with no `usage` emits nothing — correct, since the
  total did not change.
- *`error` / `notice` / `rate-limit` / `text` / `action`*: forwarded verbatim as `driver` rows,
  which is the black-box contract.
- *Throwing `emit`*: propagates into the driver's `onEvent` call. The driver seam documents that a
  throwing callback must not break the agent, so the isolation belongs on the driver side; this
  handler adding its own try/catch would only hide sink failures.

Verdict: correct (with the latent `sessionLink`-dedup coupling noted above).

### `createAgentControls(opts): AgentControls` (`L132`)

Spreads the handler and adds `agentSignal` + `answerController`. No listener is registered by this
module itself, so there is nothing to unregister; `AbortSignal.any`'s own subscriptions are released
when the composite is collected (and the composite lives exactly as long as the agent). No leak
across many agents in one daemon. Verdict: correct.

### `endStopDetail(opts): { stopped: boolean; detail: string }` (`L154`)

- *Answer stop*: `stopped: true`, fixed wording, regardless of what the loop threw. Correct — the
  answer is the reason, and the thrown `AbortError` is an implementation detail.
- *Caller stop*: `stopped: true`, detail from the error. Correct.
- *Neither*: `stopped: false`, detail from the error; a non-`Error` throw is `String()`-ed rather
  than producing `"[object Object]"`-only for objects (which it would, but no thrower in this
  codebase throws a plain object). Correct.
- *Both*: answer wording wins, which is the more specific reason. Correct.

Verdict: correct.

## Bugs found

None found.
