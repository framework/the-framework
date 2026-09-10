The health check behind the status dots of the saved devices [1]: the browser keeps each device's id, URL and token — the daemon persists none of them — and hands them to this daemon, which reaches each device's relay [2] endpoint with that token and maps the device's id to whether it answered. The token is used for the check only and never stored; the call acts only on what the browser passed, so it needs nothing of the daemon's own wiring.

## Glossary

[1] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[2] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.

## Business logic — TL;DR

- **Reachable or not, per device** - a device [1] is reachable when its daemon answers the ping with success within 3 seconds; a refusal (a wrong token, say), a host that cannot be reached, or the timeout reads as not reachable.
- **Only well-formed entries are pinged** - an entry that is not an id, a URL and a token, each a string, is dropped rather than pinged and never appears in the answer; no devices means an empty answer.
- **Memory only** - the tokens live in the browser; this daemon holds them for the duration of the check and writes nothing down.
