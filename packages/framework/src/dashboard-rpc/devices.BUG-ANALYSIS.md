# Bug analysis: packages/framework/src/dashboard-rpc/devices.ts

## Business logic (high-level)

The saved-devices health check (#1072). Devices (id, url, token) live browser-side (#1052); the browser hands them over per check, the daemon pings each with `pingRemote` in parallel and answers `{id: reachable}`. Contract points from `devices.SPEC.md`, all verified:

- **Token used, never persisted** — the token flows only into `pingRemote({url, token})`; nothing here writes state.
- **Parallel** — `Promise.all` over the valid entries.
- **Malformed entries dropped** — `isDeviceCheck` filters non-objects/missing/mistyped fields *before* pinging, so they neither get network traffic nor appear in the result (pinned by the test).
- **Inert on any host** — no context read at all; acts only on what was passed.

Edge cases considered:

- **Non-array input** — `Array.isArray(devices) ? devices : []` guards a hostile/mistyped body; combined with the filter, any JSON the browser sends is safe. Correct.
- **Duplicate ids** — `Object.fromEntries` keeps the last entry's result; the browser owns the list and doesn't produce duplicates; harmless either way.
- **`id: "__proto__"`** — `Object.fromEntries` creates own properties (it uses defineProperty semantics? no — it uses ordinary [[Set]]? Actually `Object.fromEntries` uses CreateDataPropertyOnObject, i.e. defineProperty), so a `__proto__` key becomes an own data property and does not poison the prototype. No hazard.
- **A rejecting `pingRemote`** — would reject the whole `Promise.all` and surface as an RPC error. Checked `dashboard/remote-run.ts`: `pingRemote` resolves `false` on any failure (it try/catches the fetch), so no rejection path exists in practice. Reliance on that contract noted.
- **SSRF-shaped concern** — the daemon fetches a browser-supplied URL with a browser-supplied token. This is the documented design (the daemon must do the cookie'd cross-origin ping the page cannot), the caller already holds both values, and the mount's same-origin/rebind guards bound who can ask. Not a bug against this project's intent.

## Functions (low-level)

- **`DeviceCheck`** — `{id, url, token}` strings. Correct.
- **`isDeviceCheck(value)`** — null-safe shape probe via `Partial` cast; requires all three fields to be strings. Empty strings pass (an empty URL then just pings unreachable→false) — acceptable. Correct.
- **`checkDevices(devices)`** — guard, filter, parallel ping, map. Output covers exactly the valid ids; `{}` for none. Correct.

## Bugs found

None found.
