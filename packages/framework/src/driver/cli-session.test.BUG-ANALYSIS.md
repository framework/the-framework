# Bug analysis: packages/framework/src/driver/cli-session.test.ts

## Business logic (high-level)

Pins the four risky behaviors of the shared process engine:

1. **Streaming + final turn** — parser events reach `emit` in order (`start` first, `result` last), and the resolved turn is `parser.result()`.
2. **#943 stdin EPIPE, fake shape** — an async stdin `'error'` (the broken-pipe shape) does not become an uncaught exception; the turn still fails through the normal `close(1)` path. The test deliberately lets the error land on a microtask boundary (`setImmediate`) *before* firing `close`, which is the exact ordering that used to crash.
3. **#943, real kernel EPIPE** — spawns a real `node -e 'process.exit(0)'` and writes a 1 MB prompt so the write is genuinely pending when the child dies; resolves with the parser's turn, then waits 100 ms so an unswallowed late EPIPE would fail *this* test. This is the strongest form of the pin — a fake cannot prove the kernel path.
4. **No telemetry after abort** — abort strictly before the (controlled) late `close`; asserts rejection `/aborted/` and that neither `error` nor `result` events were emitted afterwards.

Do the tests verify what they claim? Yes:

- Test 1's fake wires `close` to `stdout.on('end')` with exit 0 — the readline flush ordering is therefore not assumed, but production ordering was probed separately and holds.
- Test 2's `fireClose` defaults to a no-op and is reassigned inside the fake's `on('close')` registration, which `runCliSession` performs synchronously — so `fireClose(1)` after the `setImmediate` tick always hits the real handler. Sound.
- Test 4 aborts after `runCliSession` returned its promise, so the abort listener is registered; `fireClose(null)` after the rejection exercises the late-close guard. Sound.

Coverage gaps (not defects, noted for completeness): the SIGTERM→SIGKILL grace window, the group-kill (`detached`/negative-pid) behavior, and stderr-detail preference on non-zero exit are not exercised here — stderr detail is pinned in `claude-code.test.ts` (`/boom/`), and the kill paths are impractical to pin with these in-memory fakes.

## Functions (low-level)

- **Fake `SpawnLike`s (per test)** — minimal `SpawnedProcess` shapes; `on` returns `proc`; `kill` no-ops. In test 1 and 3 `close` chains off stdout `end`, matching real ordering closely enough for what is asserted. Verdict: correct.
- **Parsers (inline)** — `push` returns scripted events; `result` returns fixed turns; never throw. Verdict: correct.
- **Test bodies** — all `await` their assertions (`assert.rejects` awaited; no floating promises). Each test can fail: the asserted properties are causally downstream of the behavior under test. Verdict: correct.

## Bugs found

None found.
