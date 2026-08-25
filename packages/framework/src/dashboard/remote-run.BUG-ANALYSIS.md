# Bug analysis: packages/framework/src/dashboard/remote-run.ts

## Business logic (high-level)

The calling side of the relay (#1067): the local daemon (never the browser) holds the device token and drives the device — `pingRemote` (online dots, 3s timeout, any failure = offline), `startRemoteAgent` (15s timeout; non-2xx/transport failure → ordinary `ok:false` result), `relayRpc` (60s; throws on refusal so callers fall back like a failed local read), `streamRemoteEvents` (NDJSON pump), and `RelayedAgents` (per-run: the EventStream the dashboard reads, the device target that outlives the stream for post-run push/PR, and the #1077 local `AgentMeta` stub folded from streamed events via the store's own reducer).

Token handling matches the SPEC: memory-only, sent as the `fw_daemon` cookie with no Origin (verified against server.ts's guard: absent Origin + loopback Host passes), never persisted.

Lifecycle findings:
- **Stream end**: `streamRemoteEvents` ends on device close, non-2xx (rotated token → clean end, not an error), transport drop, or local `cancel()`. It does *not* end on the agent's terminal event — and the device side never closes the body either (verified: relay-endpoints' `handleEvents` + the daemon's relocating `tailRelayEvents` follow the journal forever). So the SPEC's "the stream ends … when the agent ends" holds on neither side; in production every finished remote run leaves the fetch, the EventStream, and the `agents` map entry alive until daemon shutdown, and the documented `endStream` teardown (drop the stream "the token no longer lives here") only ever runs on device restart/token rotation. The unit tests mask this because their fake devices close the body. Recorded once, against relay-endpoints.ts (the natural fix point); the alternative local fix is cancelling the pump on `event.kind === 'end'` in `register`'s onEvent.
- **Re-register**: the SPEC says "Registering the same agent again replaces its running pump", and `register` implements it — but in the wrong order (see Bugs).
- **Stream-drop without terminal event** → stub flipped `running`→`stopped` (specced, tested). `dispose` cancels every pump (safe to delete the current Map entry mid-iteration; `EventStream.close` verified idempotent) and clears targets + metas.

## Functions (low-level)

- **`pingRemote`** — try/fetch/`res.ok`; catch → false. Correct.
- **`relayHeaders`** — JSON + cookie, no Origin (a content-type on the events GET is harmless). Correct.
- **`startRemoteAgent`** — non-2xx → readable refusal with status; catch → "could not reach" with `errorMessage`. A 200 with a non-JSON body would also land in the catch (reported as unreachable — acceptable). Correct.
- **`relayRpc`** — throws on non-2xx; unwraps `{result}`; missing `result` → undefined, callers' fallback shape. Correct.
- **`streamRemoteEvents`** — line assembly keeps the trailing partial across chunks; final buffered line emitted at EOF; `TextDecoder(stream:true)` holds incomplete UTF-8 sequences (only an EOF-truncated char is lost, which is a malformed line anyway); `end()` idempotent, fired from finally and from cancel; abort surfaces as the swallowed catch. `emitLine` also swallows an `onEvent` throw (broader than the "malformed line" comment, but it keeps the pump alive — consistent with intent). Correct in isolation; see the lifecycle finding above.
- **`RelayedAgents.register`** — sets target and meta stub, cancels a previous pump, wires the new one. Bug: the cancel runs *after* `metas.set`, so the old pump's synchronous `endStream` mutates the brand-new stub (see Bugs).
- **`get` / `target` / `list`** — list filters by project and sorts `startedAt` descending (ISO string compare). Correct.
- **`apply`** — folds via `applyEventToMeta` with a local timestamp (relayed events carry none) — mirrors the device: terminal status on `end`, `settledAt` on `settled`, driver on `session`. Correct.
- **`endStream`** — idempotent (map-delete guard); closes the stream (clean `done` in the browser); flips a still-`running` stub to `stopped`. Correct except when invoked from a replacement (below).
- **`dispose`** — as analyzed. Correct.
- **`trimSlashes`** — trailing-slash trim so `${base}/_relay/...` never doubles. Correct.

## Bugs found

1. `L193-203` (`register`): replacing a live pump marks the *new* stub stopped. Scenario: `register(id, …)` is called again for an id whose pump is still live (the replacement path the SPEC names); `metas.set` has already stored the fresh `running` stub when `this.agents.get(id)?.cancel()` synchronously runs the old pump's `onEnd` → `endStream(id)` → `entry.meta.status = 'stopped'` on that fresh stub — and `applyEventToMeta` never sets a status back to `running` (verified: only `end` touches status), so the re-registered run's list row shows `stopped` while it runs, until a terminal event overwrites it. Unreachable today only because the device mints a fresh id per start. Severity: minor. Fix sketch: cancel the old pump *before* `this.metas.set(...)` (or have `endStream` skip the meta flip when the entry in `agents` is not the pump that ended).

(The never-ending stream after the agent's `end` — the leaked fetch/EventStream/`agents` entry per finished remote run — is recorded against `relay-endpoints.ts` `handleEvents`, where the fix belongs; see that analysis, bug 1.)
