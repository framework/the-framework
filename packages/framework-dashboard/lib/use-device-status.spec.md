`useDeviceStatus(profiles)` — polls the saved devices' reachability (#1072) every 10s via `checkDevices` and returns an id → `'online' | 'offline'` map for the status dots.

## TLDR

- Filters profiles to those with a token and hands the daemon each device's `{id, url, token}` — the daemon holds no device token (per-browser secret, #1052), so the browser supplies them and the daemon does the cookie'd ping (3s-capped each).
- An id missing from the map means the first check is still out — draw it neutral ("unknown"), not offline. Prerender has no daemon, so it starts empty and fills on the client.
- Display-only by design: nothing binds a control to the poll value.

## Decisions

- The poll key is the joined device-id list, so it re-polls only when the device set changes, not on every render (`targets` is a fresh array each time).
