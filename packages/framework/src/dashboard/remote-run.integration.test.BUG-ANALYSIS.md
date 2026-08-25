# Bug analysis: packages/framework/src/dashboard/remote-run.integration.test.ts

## Business logic (high-level)

The two-daemon proof of #1067: daemon B is a real `startDashboard` (real token guard, real relay endpoints, stubbed `onStart` so nothing spawns), daemon A is a real `createProjectRuntime`. One test walks the whole path and asserts, per its test SPEC:

- a start with `options.remote` creates the run on B (B's recorded call carries the prompt, `remote` stripped — no onward relay — and no projectId: slice 1, B's own home checkout) and A returns B's run id, not a locally allocated one;
- A's busy guard untouched (`activeAgentSlots` empty — no worktree, no spawn);
- the #1077 local row on A: remote-marked, B's id, device label, intent, `running` while live;
- events stream back through A's `remoteEventsSource` in order (`['hello from B', 'end']`), and after draining, the row settles to `done` — the state a reload would read;
- slice 2: `relayRpc` to B's real `/_relay/rpc` — `onGitStatus` answers `null` (B's unregistered home resolves to no checkout: proof the read ran on B and returned over the endpoint) and `sendPushBranch` answers an `ok:false` HandoffResult (proof the push executed B-side). Clever choice of oracles: the *failure shapes* prove which machine executed.

Cleanup is thorough: runtime disposed, dashboard closed (whose `closeAllConnections` reaps the still-open relay events socket — incidentally the only reason the never-closing events stream does not hang this test), temp dirs removed.

Fidelity caveats: B's `tailEvents` is `forwardStream` over an already-closed `EventStream`, so B closes the events body when the stub stream drains — the real device's file tail never closes it (see relay-endpoints.BUG-ANALYSIS.md bug 1); and `collectUntil` stops at the `end` *event* raced against a 4s timeout, so the test would pass either way — it deliberately does not pin stream closure. The final same-origin RPC hop on A is explicitly out of scope (covered by server.test.ts), as the header comment says.

## Functions (low-level)

- **`fakeBundle()`** — minimal SPA dir so `startDashboard` takes the real (non-503) path. Correct.
- **`collectUntil(stream, stopKind, timeout)`** — races the iteration against `delay`; on the race resolving, the abandoned `for await` keeps holding an iterator until dispose closes the stream — bounded by test lifetime. Correct for its purpose.
- **The test body** — every await is awaited; assertions concrete (ids, flags, deep list-row fields). `TOKEN` exercises the real cookie guard (B would 401 otherwise, failing the start assertion — implicit but real auth coverage). `defaultQuotaSource()` hands B a real poller; `deviceB.close()` stops it (server.ts calls `quota.stop()`), so no timer leak. `bStreams.set(B_RUN, stream)` keyed to the fixed id the stub returns; `bTail` reads it back — consistent. Verdict: correct.

## Bugs found

None found.
