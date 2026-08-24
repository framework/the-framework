# Bug analysis: packages/framework/dashboard/lib/use-device-status.ts

## Business logic (high-level)

Saved-device reachability for the status dots (#1072): every 10s the browser hands the daemon each saved device's `{id, url, token}` (tokens are per-browser secrets the daemon does not hold, #1052) and reads back an id→boolean map, surfaced as `'online' | 'offline'` with *absence meaning unknown*. Checked against `use-device-status.SPEC.md`:

- **Browser supplies credentials, daemon pings** — `checkDevices(targets)` with the token included. Holds.
- **Only devices with a token are checked** — `profiles.filter(p => p.token)`. Holds.
- **Unknown is not offline** — the returned map only contains ids the daemon answered for; a device absent from `reachable` is absent from the output, so the dot draws neutral. Initial value `{}` and the SSR snapshot give the same. Holds.
- **A re-pasted token takes effect immediately** — the poll key is `id + ' ' + token` joined across targets, so a token refresh (same id, new token — ids are the URL) changes `key`, which both re-creates `load` (useMemo on `[key]`) and restarts `usePolled` (deps `[key]`), issuing an immediate read with the new token. This is the #1072 regression the comment documents. Holds.
- **Display only** — returns a plain map; nothing else. Holds.

Mechanics: `targets` is a fresh array each render, but `load` is memoised on `key` — when `key` is unchanged the memo returns the *previous* closure over the previous render's `targets`, which is element-wise identical (same ids, urls=ids, tokens), so the staleness is content-free. Key collision analysis: entries joined with `|`, id/token separated by a space — a token cannot contain spaces (it comes from a URL query param... it could in principle after decoding, but the daemon generates url-safe tokens) and ids are origins (no spaces, no `|`), so distinct target sets produce distinct keys. Device-set changes (add/remove) change the key → reset to `{}` (no `keepPrevious`) → brief all-unknown, then fresh answers — matches "unknown is not offline" rather than showing a removed device's ghost.

The output map is memoised on `reachable` identity, so referential stability follows the poll's own snapshots.

## Functions (low-level)

- `POLL_MS` — 10s, per SPEC. Correct.
- `useDeviceStatus(profiles)` — as analysed. The `usePolled` deps `[key]` honour the "load closes over exactly deps" contract in spirit (load's data is a pure function of `key`). Empty target list → `load` null → never polls, value `{}` (pinned by the test). Verdict: correct.
- output memo — maps booleans to the two-word union; ids echoed from the daemon's answer (which echoes the ids it was handed). Verdict: correct.

## Bugs found

None found.
