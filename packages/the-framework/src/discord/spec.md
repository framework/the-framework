The Discord chatbot (#680/#932): chat with The Framework from Discord — inbound messages steer or start runs, and session answers are mirrored back to the asking channel.

## TLDR

- `gateway.ts` — hand-rolled minimal gateway (WebSocket) client: identify, heartbeat, resume, backed-off reconnect, MESSAGE_CREATE parsing.
- `bot.ts` — the wiring: gateway → routing decision → injected daemon effects (start/message/choice/stop), reply via REST, run↔channel binding.
- `routing.ts` — pure `decideAction`: commands, gate answers by number/label, message vs start.
- `live-run.ts` — snapshot of a project's live run + still-open gate from on-disk run state.
- `reply-mirror.ts` — polls bound runs' committed conversations and posts new agent turns into their channel (#932).
- `rest.ts` — `postMessage` with the bot token: 2000-char clamp, reply threading.

## Decisions

- No `discord.js`: the whole protocol need fits a handful of opcodes, and a client library would be the package's largest dependency by an order of magnitude.
- Pure decisions / injected effects: routing is side-effect free, every daemon effect is a parameter, and gateway/timers are seams — the same testable seam-and-`stop()` shape as the notification watchers. Errors log, never throw: chat must not take the daemon down.
- Chat history lives in Git, not here (#680's question): a routed message reaches the run over the control channel and the run commits it to `.the-framework/conversations/` (#908); the mirror reads those committed turns back out.
- Replies go where asked, by binding not guessing (#932): the bot records `runId -> channelId` at start/message time (the only moment the channel is known), binding before sending so the answer counts as new; unbound runs are never mirrored.

## Facts

- The bot token is distinct from the notification webhook (#627): webhooks post into one channel and cannot read replies.
- MESSAGE_CONTENT is a privileged intent — without it the gateway connects but every message arrives with empty content (logged explicitly, since Discord fails silently).
- Known constraint (#945): chat models one live run per project (newest running wins); accepted MVP limit until the bot can list and target runs.
- Bot-authored messages (including our own) are never acted on: two bots replying to each other is an unbounded loop that costs real money.
