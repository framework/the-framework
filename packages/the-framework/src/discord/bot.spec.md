The Discord chatbot's wiring (#680): connects the gateway, routes each inbound message through the pure `decideAction`, and executes the decision via injected daemon effects.

## TLDR

- `startDiscordBot(opts)`: opens a `DiscordGateway`, and per message — channel filter, per-message `enabled()` check (toggling off needs no daemon restart), resolve the target project and its live-run snapshot, `decideAction`, then dispatch: `choice`/`message`/`stop` steer via injected senders, `start` spawns a run, and every action posts its `reply` back threaded onto the asking message via REST.
- `onRunBound(runId, channelId)` (#932) binds the run to the channel so the reply mirror posts the session's answers back where asked.
- `DISCORD_VIA = 'discord'` (#917) names how a turn from here is attributed in the committed conversation.
- Returns `{ stop, handleMessage }` — `handleMessage` exposed so tests drive a cycle without a socket.

## Decisions

- Never throws: a chat integration that can take the daemon down is worse than a quiet one; failures log via `onLog`.
- Binding happens *before* `sendMessage` and *after* `start` (#932): binding first makes the reply reliably count as new instead of being baselined away; a just-started run has nothing to adopt, and the start is the first point its id is known.
- Chat history is not written here: a routed message reaches the run's conversation through the control channel, and the run commits it to `.the-framework/conversations/` (#908) — Git is the chat history.
- Every effect is an injected function (same seam-and-`stop()` shape as the notification watchers), keeping routing pure and the bot testable with a fake message.

## Facts

- The bot token is distinct from the notification webhook (#627): a webhook cannot read replies.
- `channelId` set restricts the bot to one channel; unset, it answers wherever addressed.
