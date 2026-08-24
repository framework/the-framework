# Bug analysis: packages/framework/dashboard/lib/use-action.test.ts

## Business logic (high-level)

Covers `useAction`'s contract: success returns the result with no error and settled busy; `{ok:false, error}` routes into `error` and returns undefined (the `out` sentinel proves the return value actually changed); a thrown `Error` uses its message and a thrown non-Error uses the caller's fallback; a void action's success returns undefined with no error (pinning the documented void ambiguity); `reset` clears the error. All awaits are inside `act`, so state applications are flushed before assertions; every assertion is failure-capable.

Gaps (noted, not bugs): `busy` is only asserted after settlement (never observed as `true` mid-flight — would need a parked promise); no test for `{ok:false}` *without* an error message taking the fallback; no concurrency case. None of these contradict a tested claim.

## Functions (low-level)

- Success test — result echoed (`{ok:true, url}` is not a failure shape since `ok !== false`), busy false, error null. Correct.
- Failure-result test — sentinel `out` becomes `undefined`; error `'nope'`. Correct.
- Thrown-error test — message path and fallback path (thrown string) in sequence on one hook, incidentally covering "error is replaced by the next attempt". Correct.
- Void-action test — sentinel becomes undefined, error stays null: distinguishes void-success from failure by the error state, exactly the discipline void callers need. Correct.
- Reset test — error set then cleared inside `act`. Correct.

## Bugs found

None found.
