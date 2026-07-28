HTTP routing and hard validation for the browser bridge (#1237): the `/_bridge/*` endpoints a Claude-web browser extension calls to report a cloud session's parked question/transcript and to fetch/acknowledge queued answers.

## TLDR

- `handleBridgeRequest` routes `/_bridge/ping|question|sessions|events|hello|answer|answered`; a daemon with no `BridgeHandlers` wired 404s everything.
- Every route demands `Authorization: Bearer <token>` (constant-time compare) before reading any body.
- POST bodies are size-capped JSON, validated field by field with a reason on rejection; `GET /sessions` returns the cloud sessions the extension should open tabs for, `GET /answer?sessionId=` returns the dashboard-queued answer (or null) for blind polling.
- Defines the wire types: `BridgeQuestion`, `BridgeEvent` (transcript entry keyed by `seq`), `BridgeHello` (extension self-report), `BridgeSession`, and the `BridgeHandlers` seam the daemon wires.

## Problems

- The bridge is the one route *meant* to be reached from another origin, so neither the #1051 non-loopback guard nor the `/_telefunc` same-origin check protects it — hence its own unconditional bearer token.
- The extension re-scrapes the page on every DOM change, so the same message arrives many times; `seq` (transcript position) is what makes event ingestion idempotent.
- Diagnosing a broken extension used to need screenshots; `/hello` lets the injected script report its own version and last scrape.

## Decisions

- No CORS headers, on purpose: the extension's service worker with `host_permissions` fetches without preflight; a wildcard would let any web page post to the daemon. Cost: the extension must post from its background worker, not the content script.
- Accepted shapes are deliberately tiny — no path, command, prompt, or free text — so a stolen token buys at worst a bogus question card on a daemon that spawns processes.
- Unknown body keys are dropped, not refused, so a newer extension works against an older daemon.
- A batch with one bad event is rejected whole: a partial accept would leave sequence gaps indistinguishable from not-yet-arrived messages.
- `/sessions` and `/answer` degrade (empty list / null) rather than 404 when the daemon wired no source, so an extension polling an older daemon does nothing instead of reporting a fault.
- `recommended` must name one of the option labels, or the rendered default would be invisible.
- Auth is checked before the body is read so an unauthenticated caller cannot make the daemon buffer.

## Facts

- Limits: 64KB body (512KB for events), 20 options, 50 events/batch, seq ≤ 10000, title ≤ 500, label ≤ 300, text ≤ 8000 chars.
- `sessionId` must match `/^session_[A-Za-z0-9]{1,128}$/`; it joins back to a run via `RunMeta.sessionId`.
- `receivedAt` is stamped by the daemon, never taken from the caller.
- Every request outcome (including refusals) is reported through `handlers.contact` on response finish, feeding the bridge-status diagnostics.
