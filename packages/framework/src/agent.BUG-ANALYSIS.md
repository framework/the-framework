# Bug analysis: packages/framework/src/agent.ts

## Business logic (high-level)

`runAgent` is the one implementation of "an agent": frame the wrapped coding agent, send the opening
prompt, honour the gates it parks on, work the backlog, take live chat, and publish one
`FrameworkEvent` stream that the dashboard, the store and the control channel all read. Per
`agent.SPEC.md` the two agent kinds (`build`, `prompt`) differ only in *which prompt opens them* and
*whether the backlog loop follows* — two options, not two implementations.

Phase order, and the guards on each:

1. **Framing** — `composeAgentSystem` once, up front (built-in #326 prompt + `SYSTEM.md`, minus
   vanilla, emptied by transparent, plus the browser/hands-off/context lines). Emitted as
   `system-prompt` so it is visible in full.
2. **Announcement** — `session` (via `emitSessionStart`), then `intent`, then `system-prompt`. All
   three are emitted *before* the `try`, which is exactly why `emit` swallows a throwing
   `onEvent`: an unguarded listener failure here would escape `runAgent` uncaught, and one inside
   the `try` could rob the agent of its `end` event.
3. **Opening exchange** — `runAwaitRounds` with the composed opening prompt.
4. **Stop check** — `if (agentSignal.aborted) throw` (the phases trip the signal but do not observe
   it).
5. **Backlog** — `runTodoLoop`, only for a non-hands-off build, defaulting on for a real driver and
   off for the fake one.
6. **Live chat** — after the backlog for a build; inside the rounds for a prompt agent.
7. **Second stop check** — the same `agentSignal.aborted` throw, for stops tripped by phases 5-6.
8. **Verdict** — `end ok:true`, or `end ok:false` with `endStopDetail`'s stopped/detail split, then
   `session.dispose()` in a `finally` so the driver process is always closed.

The stop design is the subtle part and it is right: a stop-marked answer does not return a flag up
the stack, it *aborts the same signal a Stop button aborts* (`answerController.abort`), so every
downstream observer behaves identically and the ending reads as stopped rather than as a completed
agent. Each phase that can produce a stop is followed by an explicit `agentSignal.aborted` check
because none of the phases observe the signal themselves — the SPEC calls this out twice, and both
checks are present (L220 and L252). The `end ok:false` path then classifies via `endStopDetail`
using the *caller's* signal (not the composed one), so a caller interrupt and an answer stop are
told apart correctly.

Continuation (`resumeSessionId`) is threaded to `driver.start` and makes the opening prompt verbatim
(`openingPrompt`), because the resumed transcript already carries the framing; everything around the
turn still runs, which is what "the flow resumes, not just the conversation" means.

Two places where the implementation diverges from `agent.SPEC.md`:

- **Hands-off and live chat.** The SPEC is explicit twice — "Hands-off agents never take chat" and
  "the gates, the backlog loop and live chat are all dropped rather than fed". The backlog (L228)
  and the after-backlog chat (L242) both carry `!handsOff`, but L204 wires `messages` into the
  *opening rounds* when `kind === 'prompt' || handsOff` — i.e. deliberately *including* hands-off.
  The expression reads as the negation of L242's condition ("wire chat in whichever of the two
  places will actually run it"), which is how the hands-off exclusion got lost. See bug 2.
- **The final turn's text after a no-op chat phase.** See bug 1.

Concurrency/ordering notes that check out: `events` is appended synchronously in `emit`, so the
returned array is exactly the emitted order; the driver session is created once and every phase
prompts it (each prompt a fresh invocation with `resume` where needed); `dispose` runs in `finally`
even when the `end` event's listener threw (it cannot — `emit` swallows).

## Functions (low-level)

### `runAgent(opts): Promise<RunAgentResult>` (`L129`)

**`emit`** (`L131`): pushes then notifies, swallowing listener failures with a `console.error`. Note
the ordering — the event is recorded in `events` *before* the listener runs, so a throwing listener
cannot make the returned stream lossy. Correct, and matching the SPEC's last bullet.

**Defaults**: `kind ?? 'build'`; `handsOff` from `isHandsOff(opts.location)`; `resuming` requires a
non-empty string, so `resumeSessionId: ''` correctly reads as "not a continuation" rather than
starting the driver with an empty resume id.

**Opening rounds** (`L195`): `requestChoice` is passed through unconditionally, including for
hands-off. That is benign in practice — a hand-off driver's reply carries no await gate, so no gate
can fire (the test at `agent.test.ts:824` asserts exactly that) — so the SPEC's "the gates … are
dropped" is satisfied by the driver's behaviour rather than structurally. Worth knowing, not a
defect.

**Exhausted / stopped handling** (`L208`, `L214`): the await-limit log, then the answer stop tripped
through `answerController`. Note `rounds.exhausted` is already false when a chat phase followed the
opening cap (`await-gate.ts` folds it), so the spurious await-limit notice cannot reappear here.

**Backlog gate** (`L228`): `kind === 'build' && !handsOff && (opts.todoLoop ?? opts.driver.id !== 'fake')`.
The `??` (not `||`) is what lets an explicit `todoLoop: false` win over the real-driver default, and
an explicit `true` win over the fake-driver default — both pinned by tests.

**Chat gate** (`L242`): also requires `!agentSignal.aborted`, so a stop from the backlog does not
open a chat leg on a dying agent. Correct.

**Second stop check** (`L252`) and the hands-off log (`L258`) both sit before `end ok:true`, so a
stopped hands-off agent never emits the "Handed off" line as if it had finished. Correct.

**`catch`** (`L263`): emits the failed end *then* rethrows, so the caller still sees the failure and
the log still has its verdict. `stopped` is spread conditionally so a plain failure has no
`stopped: false` noise. Correct.

Verdict: bug found (two).

### `openingPrompt(opts, resuming): string` (`L283`)

Returns the raw prompt for a continuation, a transparent agent or a vanilla agent (no built-in
prompt means no slot to render into); otherwise the user's text rendered through the system
prompt's own `# User prompt` slot. Edge cases: an empty prompt renders to an empty user half
(legal — research supplies its own text upstream); the render is pure string work with no I/O.
Verdict: correct.

### `runChatAfterBacklog(session, opts, emit, emitTurnSignals, signal)` (`L289`)

Delegates to `runChatPhase` with a **seed turn of `{ text: '' }`** and returns
`{ text: chat.turn.text, stopped: chat.stopped }`. The `stopped` flag is carried up deliberately
(the caller aborts on it). The seed is the defect — see bug 1. The dynamic `await import('./await-gate.js')`
is redundant (the module is already statically imported at the top of the file for `runAwaitRounds`)
but harmless: the second import resolves from the module cache. Verdict: bug found.

## Bugs found

1. `L243-244` (with `L300`): a build whose chat queue is empty ends with `RunAgentResult.text`
   clobbered to the empty string. `runChatAfterBacklog` seeds `runChatPhase` with `{ text: '' }`,
   and `runChatPhase` returns that seed unchanged when the first `takeQueued()` finds nothing —
   which is the *normal* end for every daemon-spawned agent (#1390: an idle queue ends the
   session). `runAgent` then does `text = chat.text` unconditionally, so the opening exchange's
   real final text is thrown away. Scenario: any dashboard-started build (`messages` wired via
   `cli.ts:929`, `stayOpenChat` unset because `opts.agentId` is set) that nobody chats to —
   `runAgent` resolves `{ text: '' }` instead of the last turn's text, contradicting the field's
   own doc ("The final turn's text"). Mitigating, hence the low severity: the only production
   caller (`cli.ts:1290`) ignores the returned value, and no test asserts on it, so the damage is
   confined to the API contract. Compare `runAwaitRounds`, which seeds the same helper with the
   real `drained.turn`. Severity: minor. Fix sketch: seed with the text in hand — pass `text` into
   `runChatAfterBacklog` and use `{ text }` as the seed (which also fixes the related staleness
   that the backlog loop's own last turn never reaches `text`).

2. `L204`: a hands-off agent is wired for live chat, which the SPEC forbids. The condition
   `opts.messages && (kind === 'prompt' || handsOff)` passes the chat source into `runAwaitRounds`
   for a hands-off build, while the two other phase guards (`L228`, `L242`) exclude hands-off.
   Scenario: the user starts a `web`-target agent from the dashboard (hands-off, `kind: 'build'`,
   `messages` wired) and types a follow-up in the composer while the hand-off is being set up; the
   message queues, and after the opening exchange `runChatPhase` takes it and prompts the *local*
   driver session again — which for the cloud driver replies with its canned "this run was already
   handed off … nothing further to do here" turn (`driver/cloud.ts` `report(…,'again')`). That is
   precisely the failure #1225's rationale describes ("reading the driver's own 'handed off'
   summary as though the agent had written it"), and it contradicts `agent.SPEC.md`'s "Hands-off
   agents never take chat" / "live chat … dropped rather than fed". The existing test
   (`agent.test.ts:872`) only proves the agent does not *hang* on an empty queue, so it does not
   catch this. Severity: minor. Fix sketch: change the condition to
   `opts.messages && kind === 'prompt' && !handsOff`.
