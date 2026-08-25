# Bug analysis: packages/framework/src/driver/fake.ts

## Business logic (high-level)

The offline `Driver`: answers from a script instead of from a coding-agent CLI, so the entire
product (dashboard, gates, queue, event streams) can run with no subscription, no CLI and no cost,
deterministically. Mirrors `AiFake` / `FakeRunner`.

Responsibilities and how they hold up:

- **Scripted turns, consumed in order, last repeating.** `resolveTurn` indexes `turns` with
  `Math.min(i, turns.length - 1)`, which is exactly the SPEC's "a short script never starves a long
  agent". `turns: []` and `turns: undefined` both degrade to `{ text: '' }` rather than crashing on
  `turns[-1]`, so an unscripted fake session yields empty turns forever instead of throwing — the
  right failure mode for a fake.
- **Dynamic answers.** `respond` takes precedence over `turns` (checked first in `resolveTurn`),
  matching the option's documented "Takes precedence". It receives the prompt and the 0-based turn
  index, and may return a bare string, normalized by `asTurn`.
- **An event stream indistinguishable from a real one.** `start` → `action`* → `text` → `result`,
  in that order, through `makeEmit`, so a throwing dashboard listener is swallowed and logged
  instead of failing the turn — the same isolation real drivers get. The one structural difference
  from `claude-code.ts` is that no `{type:'session'}` event is emitted; that is harmless because
  `createDriverEventHandler` (agent-telemetry.ts L84-90) also derives `session-update` from
  `result.sessionId`, which this driver always sets. `text` is skipped for an empty answer, which
  matches a real agent that said nothing.
- **Pre-seeded files.** `readCode` is an exact-key lookup in `files`, rejecting anything else. No
  caller outside this directory invokes `readCode` today (grep confirms), so this exists for tests
  and for symmetry with the seam.
- **Stopping.** Both the session-level and the per-prompt signal are checked, and the rejection
  wording (`[framework] fake prompt aborted`) matches `runCliSession`'s
  `[framework] <driver> prompt aborted`, so a caller matching on that phrasing behaves identically
  in fake and real runs.

**Lifecycle / ordering.** State is `index` and `prompts`, both per session. `prompt` is fully
synchronous before returning an already-resolved promise, so there is no interleaving window: two
concurrent `prompt` calls still get distinct, ordered indices, and `prompts` order matches call
order. The abort check happens *before* `index++` and before any event, so a refused prompt
consumes no script entry and emits nothing — matching `runCliSession`, which also returns before
emitting `start`. `dispose` is a no-op and idempotent; nothing is held.

**Divergence from a real driver worth naming (not a bug).** A real turn resolves asynchronously
after process exit; this one resolves in the same microtask, so a test that relies on interleaving
(e.g. aborting *during* a turn) cannot express that here. That is inherent to a synchronous fake,
and the abort-before-prompt path is the one the SPEC promises.

## Functions (low-level)

- **`asTurn(value)`** — normalizes `string | FakeTurn`. `typeof value === 'string'` is the only
  branch; an empty string yields `{text: ''}` (no `text` event, empty result) rather than being
  treated as absent, which is correct. Verdict: correct.

- **`FakeDriver.start`** — returns the concrete `FakeDriverSession` (deliberately narrowed, so tests
  can read `prompts`), never rejects. `opts` is captured by reference; a caller mutating
  `startOpts.signal` afterwards would be observed, which is what tests want. Verdict: correct.

- **`FakeDriverSession` constructor** — `id` from `config.sessionId ?? 'fake-session'`; note all
  sessions of one `FakeDriver` share that id, so two concurrent fake agents report the same session
  id. For a fake that is the point (determinism), and each agent has its own id elsewhere. Verdict:
  correct.

- **`prompt(text, opts)`** — abort check, index/record, resolve turn, emit four kinds of event,
  resolve. Edge cases: empty `text` is recorded and scripted normally; `turn.actions` absent →
  no action events; `turn.usage` absent → the key is omitted from both the event and the returned
  turn (spread-conditional), so `'usage' in turn` is false rather than `undefined`, matching the
  real drivers' shape; `opts.resume` is ignored, which the seam documents as best-effort. If
  `respond` throws, the exception propagates *synchronously* out of `prompt` rather than as a
  rejected promise — a caller doing `session.prompt(x).catch(...)` would miss it. That is a
  test-authoring hazard in a test double, triggered only by a test's own callback throwing, so it
  is not filed as a product bug. Verdict: correct.

- **`readCode(path)`** — exact key lookup; `undefined` value → rejection naming the path. A seeded
  file whose contents are the empty string works (`=== undefined` check, not falsy). No path
  normalization, so `'./a.txt'` does not match `'a.txt'` — acceptable for a literal fixture map.
  Verdict: correct.

- **`dispose`** — no-op. Verdict: correct.

- **`resolveTurn(text, i)`** — analyzed above; the non-null assertion at L96 is safe because the
  `turns.length === 0` early return guarantees an in-range index. Verdict: correct.

- **`emit(event)`** — builds a fresh `makeEmit` closure per event instead of once per session.
  Purely wasteful, no behavioural difference (the closure is stateless). Not a bug. Verdict: correct.

## Bugs found

None found.
