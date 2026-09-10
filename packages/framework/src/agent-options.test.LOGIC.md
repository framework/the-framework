What the tests cover:

- **The handoff defaults to `pr`** - preferences that say nothing about the handoff resolve to `pr`, and every rung (`local`, `push`, `pr`, `merge`) travels to the agent explicitly, so an agent can never re-arm what the launcher disarmed.
- **The repo file's toggles travel explicitly** - vanilla and transparent are sent as explicit booleans, off and on alike.
- **The repo file maps onto the preferences** - an empty file maps to nothing; `vanilla`, `transparent` and `handoff` (any rung, `local` to `merge`) are copied with the same name and the same polarity.
- **The repo file sits over the user's tier, key by key** - a key the file leaves unset keeps the user's answer; an explicit `false` in the file wins over the user's `true`, not only a `true`; merging the two tiers and then mapping, the path Auto PM takes, lets the file's transparent win while the user's model stands untouched.
- **What travels only when it is not the default** - the driver is sent only when it is not `claude`; the model passes through and an empty one does not; the location is sent only when it is not `local`.
- **The browser is Claude-only** - the browser is kept for the `claude` driver and dropped for `codex`.
