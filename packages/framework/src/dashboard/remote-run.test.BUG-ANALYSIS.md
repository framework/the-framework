# Bug analysis: packages/framework/src/dashboard/remote-run.test.ts

## Business logic (high-level)

Unit-tests the calling side of the relay against throwaway loopback HTTP servers whose handlers script the device's behavior — real fetches, real sockets, no mocks of the transport. Coverage matches the test SPEC:

- **Starting**: POST to `/_relay/start` carrying the cookie (`fw_daemon=sekret`), *no Origin* (asserted `undefined` — the property that lets the request past the device's CSRF guard), and the run body verbatim; a 403 surfaces as `ok:false` with a readable message.
- **Reachability**: ping path/method/cookie asserted; non-2xx → false; nothing listening (`127.0.0.1:1`) → false.
- **Streaming**: NDJSON lines in order; a line split across two chunks (with a real 20ms gap) reassembled; 401 → clean end with zero events.
- **Forwarded actions**: `/_relay/rpc` request shape asserted and the device result unwrapped from `{result}`; non-2xx rejects (`assert.rejects` with `/500|device/`).
- **List row (#1077)**: project-scoped rows marked remote with intent; terminal flips via real streamed `end` events (`done`/`stopped`/`failed` from ok/stopped flags) and `stopped` when the body closes with no end event; `settled` → `settledAt` set while still `running` (waiting badge), using a bounded poll loop (40×25ms) rather than a sleep.
- **Lifetime**: stream entry gone after the device closes the body while `target` survives for post-run push/PR; `dispose` clears rows and targets.

Fidelity caveat that matters: every streaming test's fake device *closes the response body* after writing its events. The real device never does (see relay-endpoints.BUG-ANALYSIS.md bug 1), so the suite validates the teardown path (`endStream`, token drop, stopped-flip) against a device behavior production does not exhibit — which is exactly how the never-ending-stream mismatch stayed green. Also unpinned: the SPEC'd re-register-replaces-pump path (the meta-flip bug in `register`) has no test.

## Functions (low-level)

- **`server(handler)`** — ephemeral port, close wrapped in a promise; every test closes in finally. Correct.
- **`stubMeta` / `drainAgent` / `drain`** — `drain` resolves on `onEnd` or a 4s timer (returning `ended: false`, which tests assert against); `drainAgent` iterates the RelayedAgents stream to completion so settle+close have run before assertions. Correct.
- **`relayEndStatus(endEvent)`** — parameterized device script; reads the row status after a full drain. Correct.
- **Individual tests** — assertions are concrete (`deepEqual` on captured request/method/cookie/origin/body; exact statuses). The "drops its token when the stream ends" test's *comment* is imprecise — `agents.get(id)` going undefined drops the stream entry, while the token deliberately survives in `targets` (as its own later test proves) — assertion right, comment stale. The waiting test disposes inside try (skipped if the poll assertion throws before it — the finally only closes the server; a dangling pump would be aborted by process exit; acceptable in tests). All awaited; all can fail.

## Bugs found

None found. (Two coverage gaps recorded in the source files' analyses: no test with a device that never closes the body — the production shape — and no re-register test.)
