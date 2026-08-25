# Bug analysis: packages/framework/src/await-gate.ts

## Business logic (high-level)

The shared gate machinery (`await-gate.SPEC.md`): resolve one parsed await gate to the user's
answer (`resolveAwaitGate`), loop answers until the agent stops asking (`drainGates`, capped at
`MAX_AWAIT_ROUNDS`), the live-chat phase (`runChatPhase`), the composed opening flow
(`runAwaitRounds`), and the two gate primitives (`requestChoices`, `requestMultiSelect`) with the
never-hang race (`raceChoiceOrAbort`). No sibling test file; behavior is pinned by
`agent.test.ts`, `cli.test.ts` and the e2e stories.

SPEC claims verified against the code:

- **One question, one pick, one continuation** — single-select answers with the picked label
  (unknown pick → recommended via `requestChoices`), multi answers with kept labels joined or
  `(none)`, unknown ids dropped by the `validIds` filter. ✓
- **Stop wins** — single: `picked?.stop === true`; multi: `picked.some(o => o.stop)`, so one
  stopping pick among several stops (SPEC's "not softened"). The stopping answer is never fed
  back (`drainGates` returns before `continueWith`), a log note is emitted, `exhausted:false`
  kept distinct from the cap. In chat, a stop ends the whole loop. ✓
- **Round identity** — round 0 `await-choices`, later rounds `await-choices-<n>`, per the SPEC's
  "first question of an exchange keeps a fixed gate identity". Ids repeat across *exchanges*
  (each chat message restarts `drainGates` at round 0) — within the letter of the SPEC, and safe
  for the event log because gates resolve strictly sequentially; the only residual hazard is a
  stale dashboard tab POSTing against a reused id and answering the *new* gate with the old
  option. Human-timing race, per-spec identity scheme → noted, not reported.
- **Never hang** — headless (`requestChoice` unset) resolves to the recommended/default set
  without pausing; abort mid-park resolves via `raceChoiceOrAbort`'s listener; a rejecting pick
  resolves to the fallback; the listener is removed on either outcome. One real gap in the
  already-aborted path — Bug 1 below.
- **Chat lifecycle (#1390/#742)** — drain-mode (`takeQueued`, checking `signal.aborted` first so
  a stopped agent takes nothing more) vs `stayOpen` (emit `settled`, park on `messages.next`);
  the *last* chat turn's `exhausted` is what `runAwaitRounds` reports once chat ran, and a
  stopped chat reports `stopped` — matching the SPEC's end-reason rule. ✓
- **Signals every turn** — `emitTurnSignals` after the opening prompt, after every continuation
  inside `drainGates`, and after every chat delivery. ✓
- **Resume (#720)** — `resume: true` only on the opening prompt and only when seeded; chat
  deliveries always resume. ✓

## Functions (low-level)

- **`resolveAwaitGate(gate, round, deps)`** — multi path forwards `default` flags (but not
  `stop`, correctly: stop is resolution-side, read off `gate.options`); single path forwards
  `recommended`/`file` only when present. Empty `gate.options` would yield `answer: ''` — 
  unreachable, `parseAwaitGate` requires ≥1 option (reliance noted). Verdict: correct.
- **`drainGates(turn, deps, continueWith)`** — loop condition `round < MAX_AWAIT_ROUNDS && gate`;
  `exhausted: gate !== undefined` is exactly "still asking when the cap ran out". A rejection
  from `continueWith` (e.g. aborted driver) propagates — callers own it (run.ts), consistent
  with the other paths. Verdict: correct.
- **`promptContinuation(session, deps)`** — plain `session.prompt(continuationPrompt(...))` with
  the signal. Note it does not pass `resume: true`; a driver session object carries its own
  continuity between `prompt` calls, and chat deliveries that need `--resume` pass it at the
  delivery site — consistent with `runChatPhase`. Verdict: correct.
- **`runChatPhase(session, messages, seed, deps, stayOpen)`** — described above. In stayOpen
  mode, `messages.next(deps.signal)` resolving `undefined` on Stop/close ends the loop; the
  `settled` event re-emitted each round is per SPEC ("announcing each time"). Verdict: correct.
- **`runAwaitRounds(opts)`** — composition; a stopped opening drain returns before chat, headless
  returns the drain result unchanged. Verdict: correct.
- **`raceChoiceOrAbort(pick, signal, fallback)`** — no signal: `pick.catch(() => fallback)`;
  aborted-already: immediate fallback **without ever attaching to `pick`** (see Bug 1 — the
  promise was already created by the caller); otherwise races with a once-listener that is
  removed when the pick settles. Never rejects. Verdict: correct in isolation; the caller's
  argument-evaluation order makes the aborted branch leaky.
- **`requestChoices(deps)`** — emits `choice`, computes `recommended` (falls back to the first
  option id), maps the pick through `pickedIds(...)[0]`, coerces unknown picks to the
  recommended id, emits `choice-resolved` with `by`. Verdict: correct except Bug 1.
- **`requestMultiSelect(deps)`** — same shape; resolves to the valid subset (empty allowed);
  headless takes the default-checked set. Verdict: correct except Bug 1.

## Bugs found

1. `L327` (and the same shape at `L392`): **a gate reached after the abort already fired parks an
   unresolvable promise and leaks the CLI's gate keepalive — the stopped agent's process never
   exits.** `requestChoice(req)` is evaluated as the argument *before* `raceChoiceOrAbort` checks
   `signal.aborted`. The production handler (cli.ts L920-924) registers a resolver in
   `pendingChoices` and wraps the promise in `gateKeepalive.hold(...)` — a ref'd interval held
   until the promise settles. The abort listener that resolves pending choices (cli.ts L793-797)
   has already run by then, so the new resolver is never called: the keepalive interval stays
   ref'd forever, and a daemon-spawned agent (`--no-dashboard`, detached stdio) finishes its run
   but the Node process lingers indefinitely — an orphan holding an auto-PM concurrency slot
   (the "process that had outlived its finished run" symptom #1646 describes). Scenario: the
   turn's text ends in an await block; Stop (or the budget-cap abort, #322) fires in the window
   between the turn settling and the gate parking; `resolveAwaitGate` runs with
   `signal.aborted === true`. The gate itself resolves to the fallback (so the SPEC's "never
   hangs" holds for the *run*), but the process leaks. Severity: major. Fix: don't ask at all
   when the signal is already aborted — in both primitives:
   `const pick = requestChoice && !deps.signal?.aborted ? await raceChoiceOrAbort(requestChoice(req), deps.signal, fallback) : fallback`.
