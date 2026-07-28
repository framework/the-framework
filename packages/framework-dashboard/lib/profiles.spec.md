Client connection profiles (#1052): the saved daemons this browser can hop to, stored in localStorage and exposed as reactive state for the device picker and connected indicator.

## TLDR

- "A device I have" is a CONNECTION, not a run driver: the SPA is served by its daemon and every transport is same-origin, so switching devices navigates the browser to that daemon's origin, where the #1051 bootstrap sets the `fw_daemon` cookie from `?token=` and everything is same-origin again.
- `listProfiles`/`addProfile`/`removeProfile` — CRUD over the `fw.devices` localStorage array, newest first, keyed by origin: a repeat paste of the same box refreshes its token rather than stacking a duplicate; malformed entries are filtered on read.
- `parseDeviceUrl` — pulls origin + token out of the `http://host:port/?token=…` URL the box prints on a non-loopback bind (cli.ts), normalized to the bare origin so it matches `window.location.origin`.
- `connectUrl`/`connectTo` — the hop: origin + `?token=` + `?draft=` (live composer draft, #1066) so a device hop never nukes the typed prompt; drafts over 7000 chars are dropped (plain connect) rather than blowing the URL length.
- `rememberLocalOrigin`/`localOrigin`/`connectLocal` — remembers the loopback launch origin under `fw.local-origin` so "Local" returns to the right port from a remote box; default `http://127.0.0.1:4200` (the daemon's default port).
- `currentConnection` — labels the daemon the browser is on: loopback = "Local", else the saved profile's label, else the bare host.
- `useConnectionProfiles()` — tiny `useSyncExternalStore` store: localStorage has no in-tab change event, so writes notify explicitly; the snapshot is cached until then (re-reading fresh each call would loop on identity comparison).

## Decisions

- Storage is deliberately client-side localStorage: the token is a per-browser secret and must never reach the daemon's registry file (the wrong home, shared across browsers).
- Node-free leaf (like agent-names.ts / preference-defaults.ts) so nothing node leaks into the SPA bundle.

## Facts

- The #1051 bootstrap 302 strips only `token`, which is why `draft` survives to the remote SPA (stashed there by draft-handoff.ts).
- `token` is empty only for the loopback Local profile; loopback hosts are `localhost`, `127.0.0.1`, `[::1]`, `::1`.
