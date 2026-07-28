The local-daemon half of "run on a connected device" (#1067): starts runs on a remote daemon, pumps the remote's NDJSON event stream into a local `EventStream`, and tracks live relayed runs (tokens, list stubs, post-run RPC targets).

## TLDR

- `pingRemote` (#1072, 3s timeout), `startRemoteRun` (POST `/_relay/start`, 15s; non-2xx/transport failures surface as the same `{ok:false}` shape a local refusal has), `relayRpc` (POST `/_relay/rpc`, 60s — a relayed push/PR runs over the network; throws so callers fall back like a failed local read).
- `streamRemoteEvents`: fetch-streams `/_relay/events`, line-buffering NDJSON (partial trailing lines kept for the next chunk; malformed lines dropped); returns a cancel function.
- `RelayedRuns`: per remote run id — the pump + `EventStream` the dashboard reads over its normal `onEvents` channel, the device target, and a local `RunMeta` stub (#1077) folded forward per event via the store's own `applyEventToMeta` reducer so `onRuns` lists the remote run and a reload re-opens it.

## Problems

- The browser must never talk cross-origin and the token must never leave the two daemons (#1067(b)): the local daemon — which holds the saved device's token — drives the remote, and the dashboard reads same-origin.
- A 401 mid-stream (token rotated) ends the stream *cleanly* — a normal `done`, not a lost connection.
- A stream that drops with no terminal event leaves the stub `running`; `endStream` flips it to `stopped` so the list stops showing a dead run as live.

## Decisions

- Auth is the #1051 cookie sent daemon-to-daemon (`Cookie: fw_daemon=<token>`, no `Origin` header on purpose — the remote's CSRF check passes absent Origin, and these raw routes are not under it anyway).
- `targets` and `metas` outlive the event pump: a finished remote run's post-run reads/push/PR must still reach the device after its stream ends, so they are kept until `dispose()` (daemon shutdown), not dropped on stream close.
- Re-registering the same run id replaces the old pump; tokens are memory-only for the run's lifetime, never persisted.

## Flows

- relay a run: `startRemoteRun()` → remote's runId → `RelayedRuns.register(runId, target, stubMeta)` → `streamRemoteEvents()` pushes into `EventStream` + `applyEventToMeta` per event → stream ends → `endStream()` closes (surfaces as `done`) → post-run RPCs still reach the device via `target(runId)` until `dispose()`.
