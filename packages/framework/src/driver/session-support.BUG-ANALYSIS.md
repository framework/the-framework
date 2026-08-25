# Bug analysis: packages/framework/src/driver/session-support.ts

## Business logic (high-level)

The driver-agnostic session helpers: event emission that isolates listener failures from the agent, folding session-level and per-call abort signals, folding session-level and per-call framing, and reading a file out of the workspace. Per its SPEC, the one hard rule is that a throwing event listener never takes the agent down — the failure is logged with the driver's name and the agent carries on.

All four helpers are used by every local driver (`claude-code.ts`, `codex.ts`, `fake.ts`, `cloud.ts` uses `makeEmit`), which is exactly the point: the agent-specific parts stay in each driver.

## Functions (low-level)

- **`makeEmit(onEvent, driver)`** — absent `onEvent` → no-op function (cheap, allocation-free per event). Present → wraps in try/catch, logs `[framework] ${driver} onEvent threw; ignoring:` with the error. Edge cases: a listener that throws a non-Error (string) is still caught and logged; a listener that throws on *every* event floods stderr with one line per event — acceptable, traceable by design. Re-entrancy (a listener that emits again) is the caller's concern; nothing here recurses. Verdict: correct.
- **`combineSignals(...signals)`** — filters out `undefined`/`null`, returns the remaining `AbortSignal[]`. Deliberately does *not* merge them into one signal (no `AbortSignal.any`), leaving fan-in to `runCliSession`, which registers a listener per signal and pre-checks `aborted`. Duplicate signal instances would register twice downstream — harmless (settled-guard). Verdict: correct.
- **`combineFraming(...parts)`** — `filter(Boolean).join('\n\n')`. Empty strings and `undefined` are dropped, so no stray blank blocks; zero parts → `''`, which callers test with `if (system)` before using. A part that is only whitespace survives (truthy) — callers pass either `undefined` or real framing, so not reachable in practice. Verdict: correct.
- **`readWorkspaceFile(cwd, path)`** — `readFile(resolve(cwd, path), 'utf8')`. Edge cases: a relative path resolves under the workspace; an *absolute* `path` or one with `..` escapes the workspace entirely (`resolve` semantics). This backs `DriverSession.readCode`, whose callers are framework code reading agent-produced file names; the agent already has arbitrary read access to the machine through its own tools, so no security boundary is crossed — but note the reliance: `readCode` callers must not treat the cwd as a jail. Missing file rejects with ENOENT, propagated to the caller (FakeDriver mirrors this with its own rejection). Verdict: correct (reliance noted).

## Bugs found

None found.
