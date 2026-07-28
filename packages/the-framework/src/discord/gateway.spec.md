A minimal hand-rolled Discord gateway (WebSocket) client (#680): identify, heartbeat, resume, and MESSAGE_CREATE dispatch — the inbound half the outbound-only webhook could not provide (#627).

## TLDR

- `DiscordGateway` owns the socket, heartbeat timer, and resume state; hands each usable chat message to `handlers.onMessage`, READY's self id to `onReady`, diagnostics to `onLog`. `stop()` (the Ctrl+C path) closes for good; no reconnect follows.
- Protocol: on hello, start heartbeating at the server's interval and identify (or resume with `session_id` + `seq`); heartbeat/reconnect/invalidSession opcodes handled; a missed heartbeat ack marks the connection a zombie and closes it so onClose resumes.
- `parseMessage` narrows a MESSAGE_CREATE payload to `DiscordMessage` (id, channel, content, author, fromBot, replyToId).
- All timers/sockets are injectable seams (`GatewayDeps`) so tests drive the protocol with fakes; defaults wrap the global `WebSocket` (node >= 22) and unref'd timers so nothing keeps the daemon alive.

## Problems

- Reconnect must be backed off (1 s doubling to 60 s cap, reset once a connection reaches READY): a connection that fails instantly (offline, bad token) closes as fast as it opens, and inline reconnects pin a core and get the bot rate-limited.
- A socket-factory throw means no onClose will ever fire, which would end reconnection for the daemon's lifetime (#942) — it falls through to the same backoff path.
- The privileged MESSAGE_CONTENT intent failing is silent: the gateway connects and every message has empty `content`, so empty-content messages are logged with the fix ("enable the MESSAGE CONTENT intent").

## Decisions

- Hand-rolled over `discord.js` on purpose: the package has three runtime dependencies, and a client library for this handful of opcodes would be the largest dependency by an order of magnitude.
- Never act on a bot's message, our own most of all: two bots replying to each other is an unbounded loop that costs real money (checked via `fromBot` and `authorId === selfId`).
- Errors are swallowed into `onLog` rather than thrown — same contract as the notification watchers.

## Facts

- Endpoint: `wss://gateway.discord.gg/?v=10&encoding=json` (JSON encoding, no zlib/etf); Discord's `resume_gateway_url` carries no query, so `?v=10&encoding=json` is re-appended.
- `CHAT_INTENTS` = guildMessages | directMessages | messageContent.
- invalidSession drops `sessionId`/`resumeUrl` so the reconnect identifies fresh; opcode 7 (reconnect) just closes and lets onClose resume.
