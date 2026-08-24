# Bug analysis: packages/framework/dashboard/lib/use-action.ts

## Business logic (high-level)

The uniform mutation wrapper (write-side twin of `use-async`): `run(fn, fallback)` flips `busy`, clears the previous error, awaits, routes `{ok:false, error?}` results and thrown errors into one error string, lifts `busy` in `finally`, and returns the result on success / `undefined` on failure. Matches `use-action.SPEC.md`: busy always lifts; two failure shapes present as one message (the daemon's reason, else the control's fallback); the error persists until the next attempt or `reset`; the caller runs success behaviour only on a real success.

Edge analysis:

- **Void actions** — a `Promise<void>` success also returns `undefined`, indistinguishable from failure by return value. Deliberate and pinned by the test ("a void action returns undefined and sets no error on success"); such callers must not branch on the return, only on `error`. Reliance, not a bug.
- **Thrown non-Error / empty-message Error** — non-Errors take the fallback; an `Error('')` takes its empty message (`err.message` is `''`, not the fallback) → the error state becomes `''`, which renders as no visible message while still being non-null. Cosmetic corner; RPC failures always carry text (`rpc.ts` always constructs a message). Noted only.
- **Concurrent runs on one hook** — the first to settle lifts `busy` while the second is still out, and errors interleave last-writer-wins. Call sites disable their controls on `busy` (e.g. AgentHandoff's buttons), so a second run cannot start from the UI; `use-agent-handoff` layers `pending` on top with the same protection. Reliance on the disable pattern, noted.
- **Unmount during flight** — `setError`/`setBusy` on an unmounted component are no-ops in React 18; the promise chain holds no other resources. Fine.
- **`isFailure`** — `typeof result === 'object' && result !== null && 'ok' in result && ok === false`. Arrays/objects without `ok` are successes; `{ok: false}` without `error` takes the fallback (`?? fallback`). An RPC returning `{ok: 0}` would not read as failure (`=== false` strict) — no such RPC exists. Correct.

## Functions (low-level)

- `useAction()` — state pair + stable `reset`/`run` (both `useCallback([], …)`, valid: they close over setters only). Returns `{busy, error, reset, run}`. Verdict: correct.
- `run(fn, fallback)` — as analysed; `finally` guarantees busy lifts on every path, including a synchronous throw from `fn()` itself (invoked inside the `try`, so it lands in the same catch as a rejection). Verdict: correct.
- `isFailure(result)` — type predicate as analysed. Verdict: correct.

## Bugs found

None found.
