# Bug analysis: packages/framework/src/agent.test.ts

## Business logic (high-level)

39 `node:test` cases — the largest suite in the batch — covering `runAgent` end to end plus the
gate primitives it leans on (`runAwaitRounds`, `drainGates` indirectly, `requestChoices`,
`requestMultiSelect`, `resolveAwaitGate`). Almost everything runs offline against `FakeDriver` /
`fakeDriver()`; only four cases touch the filesystem, and each `mkdtemp`s its own directory and
removes it in a `finally`. Several drivers are deliberately named `'fake'` so the workspace-verify
stays off and the unit tests keep off disk — a stated technique, and a real coupling to
`driver.id === 'fake'` semantics elsewhere (it also switches the backlog-loop default, which two
tests then override explicitly).

Mapping to `agent.SPEC.md`, bullet by bullet:

- *An agent is one prompt, honouring gates*: `L30` (the whole flow, offline), `L297` (no preset,
  no serve config → the opening prompt is the only prompt), `L967` (a prompt agent runs its text
  and works no backlog).
- *The framing is composed once, up front*: `L127` asserts the driver's `system` is **exactly**
  `composeAgentSystem({tf})` — the strongest possible statement of "runAgent composes no framing of
  its own"; `L139` (transparent empties it); `L144` (nothing project-shaped leaks in).
- *Every agent opens with the user's text itself*: `L952` asserts `prompts[0]` is the raw intent
  for a build, which pins the user-prompt-slot render being the identity today; `L967` pins the
  vanilla path; `L888` pins the continuation path (verbatim, plus `resumeSessionId` reaching
  `driver.start`).
- *Every turn's question is a gate*: `L255` (live gate + re-prompt with the pick), `L326` (multi-
  select gate), `L357` (plan approval), `L500` (headless auto-accept of the recommended option),
  and the primitive-level cases at `L186`-`L246` and `L530`-`L594` (headless defaults, invalid-id
  fallback, abort-while-parked fallback, empty selection).
- *An answer that says stop ends the agent*: `L395` (declined plan → rejects, `end ok:false`,
  `stopped:true`, `detail:'stopped by your answer'`, and — the sharpest assertion in the file —
  `resumed === false`, i.e. the agent is never told the answer that ended it); `L435` (an
  *unmarked* "Decline" is an ordinary answer, so the mechanism is the marker and not the wording);
  `L468` (a stop in the **chat** leg, the path that used to settle `ok:true` and publish the
  declined work); `L692` and `L710` at the `runAwaitRounds` level.
- *The agent queue is worked after the opening exchange settles*: `L595` (fake driver → no backlog
  by default), `L607` (opted in, against a real git fixture with a data branch, asserting the
  `TodoLoopResult` and that "Backlog done" precedes `end`).
- *Live chat comes last*: `L468` (chat leg reached after the build), `L744` (stay-open parks are
  announced, one per wait), `L781` (a chat phase after the opening cap clears `exhausted`).
- *A hands-off agent is its opening prompt and nothing else*: `L820` (one prompt, no backlog, no
  gate, the untouched `TODO_AGENTS.md`, and the "Handed off:" log before `end`), `L857` (framing
  says land-everything and does **not** say decide-alone), `L872` (does not hang on an open chat
  queue).
- *The agent always ends with a verdict*: covered across the stop/failure cases above.

Test-quality checks: every `assert.rejects` is awaited (`L396`, and `L468`'s deferred `const run =`
… `await run`); the two message-driven cases (`L468`, `L757`) push before the agent can reach the
chat phase and then `await setImmediate` before closing, so they are deterministic rather than
timing-dependent; `L872` races the agent against an `unref`'d 2 s timer and asserts the winner is
not `'waited'`, which fails loudly on a hang. Nothing asserts on a promise it forgot to await.

Weaknesses worth recording (none of them a defect in the tests themselves):

- **`RunAgentResult.text` is never asserted anywhere in the file.** That is exactly the blind spot
  in which the `text = chat.text` clobber recorded in `agent.BUG-ANALYSIS.md` (bug 1) survives: a
  build with a wired-but-idle chat queue returns `{ text: '' }`, and the closest test (`L468`)
  only inspects events. A regression test would be `assert.equal((await runAgent({…, messages})).text, 'built it')`
  with nothing pushed.
- **`L872` under-tests the hands-off/chat rule.** It proves only that the agent does not hang on an
  *empty* queue; it does not push a message, so it cannot detect that a hands-off agent still takes
  chat turns (`agent.BUG-ANALYSIS.md` bug 2). Pushing a message and asserting the driver received
  exactly one prompt would pin the SPEC's "Hands-off agents never take chat".
- `L127`'s expectation is computed with the same function under test, so it can only detect
  *runAgent* appending framing, never a fault inside `composeAgentSystem`. That is the right split
  of responsibility (that function has its own tests), but the assertion is weaker than it looks.
- `promptRecordingDriver` (`L153`) is defined and never used — dead helper.
- The suite mixes unit tests of `await-gate` primitives into the agent file; harmless, but it means
  a failure here does not localise to `agent.ts`.
- Nothing covers a throwing `onEvent` listener, even though "a surface that throws is ignored — with
  the failure logged" is one of the SPEC's stated behaviours and the `try/catch` in `emit` is what
  keeps the agent's `end` event alive.

## Functions (low-level)

### `recordingDriver()` (`L17`) / `promptRecordingDriver()` (`L153`) / `handsOffDriver()` (`L806`) / `realNamedDriver()` (`L933`)

Four wrapper drivers over `FakeDriver`, each recording a different thing (the `system` framing, the
prompts, the hand-off shape, the prompts with a *real* driver id so the workspace check is live).
`realNamedDriver` spreads the session (`...session`) and then re-adds `dispose`/`prompt`; the
comment on the sibling at `L897` explains why the spread alone would drop `dispose` (prototype
methods). Both wrappers get this right. Verdict: correct.

### The `runAgent` event-shape tests (`L30`-`L149`)

Session announcement, `session-update` (exactly once for the fake's stable id, after the `session`
event), `{sessionId}` template resolution, running usage totals with a monotonic `turns` count, the
literal-link case, and the three framing assertions. `L88`'s `last.turns === usage.length` is a neat
way to pin one usage event per usage-reporting turn. Verdict: correct.

### The gate-primitive tests (`L186`-`L253`, `L530`-`L594`)

Headless defaults, user picks filtered to valid ids, abort-while-parked falling back rather than
hanging (both single- and multi-select), the empty selection, and — `L246` — that one stopping pick
among several is still a stop. All synchronous-ish and deterministic; the abort cases abort from
*inside* the `requestChoice` callback, which is the only way to make the race deterministic.
Verdict: correct.

### The gate flow tests through `runAgent` (`L255`-`L527`)

Each builds a `FakeDriver` whose `respond` branches on the prompt text (`/You paused to ask/`), so
the continuation wording is itself part of what is pinned. `L395`'s `resumed === false` and `L435`'s
`resumedWith` are complementary: the same gate shape with and without the `stop` marker.
Verdict: correct.

### The backlog tests (`L595`, `L607`)

`L607` is the only heavyweight fixture: a real git repo with a data branch holding
`TODO_AGENTS.md`. It asserts the `TodoLoopResult` exactly and that the "Backlog done" log precedes
`end`. Slow but genuinely end-to-end. Verdict: correct.

### The `runAwaitRounds` tests (`L661`-`L800`)

Gate → re-prompt → signals (`L661` asserts the exact prompt sequence via `continuationPrompt`, and
that *every* turn including the gate turn went through the signal emitter — the #563 regression);
stop instead of re-prompt; the approving half of the same gate; the `MAX_AWAIT_ROUNDS` cap
(`prompts.length === MAX_AWAIT_ROUNDS + 1`, i.e. the opener plus one per round — the off-by-one is
stated rather than assumed); two `settled` events for a stay-open chat; and `exhausted:false` when a
chat phase follows the cap. Verdict: correct.

### The hands-off tests (`L820`-`L887`)

`L820` is thorough (prompt count, `todo === undefined`, no gates asked, the backlog file untouched
on disk, and the "Handed off:" log ordered before `end`). `L857` asserts both the presence of the
land-everything line and the *absence* of "decide alone", which is the #1554 distinction. `L872` is
the weak one discussed above. Verdict: correct (under-covering, not wrong).

### The continuation test (`L888`)

Pins `resumeSessionId` reaching `driver.start`, the verbatim first prompt, and that the flow still
runs as a build (`intent` event). Verdict: correct.

### The opening-prompt tests (`L952`, `L967`)

Both use `realNamedDriver` so the real-driver code paths (workspace verify, backlog default) are
live, and both disable the backlog explicitly (`todoLoop: false` / `kind: 'prompt'`) so the
assertion on `prompts.length` is about the opening prompt only. Verdict: correct.

## Bugs found

None found. (The two source defects recorded in `agent.BUG-ANALYSIS.md` both live in this file's
coverage gaps: `RunAgentResult.text` is never asserted, and the hands-off chat test never pushes a
message.)
