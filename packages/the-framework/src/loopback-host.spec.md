Loopback-address helpers shared by the daemon and the dashboard's Telefunc mount.

## TLDR

- `isLoopbackHost`: `localhost`, `::1`, `[::1]`, `127.*` — anything else (a bind-all `0.0.0.0`/`::`, a routable address) is not loopback, and the daemon gates it behind the shared token (#1051).
- `hostnameFromHostHeader`: drops the port from a `Host` header, keeping the bracketed IPv6 form (`[::1]:4200` → `[::1]`) that splitting on the first colon would mangle.

## Decisions

- A leaf module with no imports of its own: `daemon.ts` imports the dashboard, so the Telefunc mount cannot reach back into `daemon.ts` for `isLoopbackHost` without a cycle. `daemon.ts` re-exports it so its own callers (`cli.ts`) are unaffected.
- A single definition rather than a copy per caller: the daemon's "does this bind need a token" decision and the mount's "is this `Host` a rebinding attempt" decision must not drift apart.
