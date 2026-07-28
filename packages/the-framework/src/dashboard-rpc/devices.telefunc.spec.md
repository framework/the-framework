The saved-devices health check (#1072): `checkDevices` pings each browser-supplied `{id, url, token}` device and returns an id→reachable map for the status dots.

## Decisions

- Device tokens live browser-side (#1052): the daemon uses each token only for the cookie'd cross-origin ping and never persists it; no request context needed, so the RPC is inert on any host.
- Malformed entries are filtered out rather than failing the call.
