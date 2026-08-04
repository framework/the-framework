A hand-rolled Discord gateway client — identify, heartbeat, resume, reconnect, message events — over the global `WebSocket`.

## Decisions

- Hand-rolled on purpose: the package has three runtime dependencies and builds on node builtins; pulling `discord.js` for eight opcodes would be the largest dependency in the package by an order of magnitude.
- Reconnect backoff (doubling to a cap, reset only once a connection reaches READY) is not a nicety: a connection that fails immediately closes as fast as it opens, and inline reconnection is a tight loop that pins a core and gets the bot rate-limited.
- A connection-factory throw still schedules a reopen — with no socket, no close event will ever fire, so returning early would end reconnection for the daemon's lifetime.

## Facts

- Message content is a **privileged intent**: without it enabled in the developer portal, the gateway connects fine and every message arrives empty — a silent failure, so an empty message is logged with the exact fix.
- A missed heartbeat acknowledgement closes the socket (zombie detection) and lets the close path resume; an invalid-session opcode clears the session so the reconnect identifies fresh; the resume URL loses its query string and the version/encoding parameters are re-appended.
- All timers are unref'd so a heartbeat or pending reconnect never keeps the daemon process alive.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
