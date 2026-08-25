# Bug analysis: packages/framework/src/dashboard/relay-endpoints.ts

## Business logic (high-level)

The device side of the remote-agent relay (#1067): `/_relay/ping` (reachability + auth probe, works with no handlers wired), `/_relay/start` (run an ordinary local agent here, never relay onward — nested `remote` stripped), `/_relay/events?run=<id>` (NDJSON stream of the agent's events), `/_relay/rpc` (one whitelisted run-scoped action). Auth is outside this file: the shared-token guard plus `guardBrowserOrigin` in server.ts front every `/_relay` route (verified), so a token-less or browser-cross-origin caller never reaches these handlers — the SPEC's "only an authenticated daemon gets in" holds at the mount, and this file correctly does no auth of its own.

Behaviors verified against the SPEC:
- ping answers 200 empty on GET, 405 otherwise; available with `handlers === undefined` while everything else 404s "relay not enabled" — "relay off means gone… except the ping".
- start: body size-capped (256 KiB), malformed/oversized → 400; unknown `kind` coerced to `'build'`; non-string prompt → `''`; `remote` stripped from options (no onward relay); a throwing `start` is answered as an `ok:false` *result* (HTTP 200), so the calling daemon reports it like a local failure — as specced.
- rpc: 404 when not wired, 400 on no name/bad body, 500 with the error's message on failure, `{result}` wrapping on success. Whitelisting is the wired handler's job (`dispatchRelayRpc`), per the SPEC's "only a whitelisted set is accepted".
- events: 400 with no `run` id; NDJSON with `cache-control: no-cache`; a dropped write is swallowed (`res.write` on a destroyed socket returns false rather than throwing — the try/catch is belt-and-braces); `close` on req/res tears the tail down (double `stop()` is harmless — `tailEvents`' stop is idempotent via its `stopped` flag).

The one contradiction found: both this SPEC ("streams that agent's events … until the agent ends or the caller disconnects") and the calling side's promise that the stream ends "when the agent ends" are not implemented on either side. `handleEvents` never ends the response — the wired tail (`tailRelayEvents` → `tailAgentEvents`, verified in daemon-runtime.ts/events-tail.ts) follows the journal across relocation *forever*, including after the terminal `end` event is written. See Bugs.

## Functions (low-level)

- **`handleRelayRequest`** — exact-path routing (trailing slash → 404, fine); ping before the handlers check. Correct.
- **`handlePing`** — as above. Correct.
- **`handleStart`** — `readJsonBody` errors → 400. Note the oversized path calls `req.destroy()` inside `readJsonBody` and then writes the 400 to a destroyed socket — Node's `OutgoingMessage._writeRaw` silently drops writes on a destroyed connection, so no crash; the caller sees a reset, which still reads as a refusal. `options` is cast unchecked, acceptable for an authenticated daemon peer. Correct.
- **`handleEvents`** — see Bugs. Otherwise correct: unknown run id yields an open-but-silent stream (the tail resolves no path and polls; nothing streams) — tolerable given authenticated callers name ids they were just handed.
- **`handleRpc`** — as above; `end(res, 500, err.message)` leaks only the error text to an authenticated peer. Correct.
- **`readJsonBody`** — accumulates with a byte cap, rejects then destroys on overflow (late reject-after-resolve impossible: reject wins the race and later `end` settlement is a no-op); `end` parses, `error` rejects. Empty body → `JSON.parse('')` throws → 400 at both call sites. Correct.
- **`end`** — plain-text status with optional headers (`allow` on 405s). Correct.

## Bugs found

1. `L92-108` (`handleEvents`, jointly with `remote-run.ts`'s pump): the events response is never ended when the agent ends, so both SPECs' "until the agent ends" is unimplemented. Scenario: an agent relayed here finishes; its `end` event is written to the caller, then the wired relocating tail keeps fs-watching/1s-polling the archived journal and the HTTP response stays open until one daemon shuts down — per finished remote run, a leaked socket on both daemons plus a permanent file watcher/poll here, and on the calling side `RelayedAgents` keeps the pump and stream alive (its documented cleanup on stream close never runs; the unit tests only pass because their fake device closes the body). Severity: minor (unbounded only in remote-run count; behavior visible as "stream never done"). Fix sketch: in the tail callback, after writing an event with `kind === 'end'`, call `stop()` and `res.end()` — the caller's `streamRemoteEvents` then sees the body close and `RelayedAgents.endStream` runs its normal teardown.
