The device-side half of the remote-run relay (#1067): the raw `/_relay/*` endpoints a daemon exposes so another daemon holding this device's token can start a run here, stream its events back, and call run-scoped RPCs.

## TLDR

- `POST /_relay/start`: starts an ordinary local run via the wired `start` closure (kind defaults to `build`), answering its `StartRunResult` — failures become `{ok:false}` JSON, never a 500.
- `GET /_relay/events?run=<id>`: streams that run's events as newline-delimited JSON until it ends or the caller disconnects (both `req` and `res` close handlers tear the tail down; a dropped mid-line write is swallowed).
- `POST /_relay/rpc` (#1067 slice 2): runs one whitelisted run-scoped RPC (read/diff/steer/handoff/push/PR) against this device's own checkout, answering `{result}`.
- `GET /_relay/ping` (#1072): a cookie-guarded reachability probe — 200, empty body, starts nothing, answers even when no relay handlers are wired.
- Unwired hosts 404 everything except ping; bodies are capped at 256KB.

## Facts

- Authentication happens *before* this module: the #1051 token guard in `startDashboard` fronts `/_relay/*`, admitting a matching `fw_daemon` cookie without the browser-only `?token=` 302; a token-less caller is already 401'd.
- The dashboard's online/offline device dots are the local daemon calling `/ping` on each saved device with its token.

## Decisions

- A relayed run must never relay onward: `handleStart` strips any nested `options.remote` before starting locally.
