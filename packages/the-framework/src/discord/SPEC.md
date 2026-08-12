Discord as a chat surface for sessions: read messages from a channel, act on them exactly as a dashboard click would, and mirror the session's answers back.

## Flows

- Inbound: a minimal hand-rolled Discord connection feeds pure routing rules — given a message and a snapshot of the project's state, decide what it means: answer the parked question (by option number or label), message the live session, start one, stop it, or just reply. The chosen action goes through the same control channel as a dashboard click, so the session cannot tell the difference, and the message lands in the session's committed conversation — the durable chat record.
- Outbound: the reply mirror posts a session's answers back to the channel that asked. The source is the committed conversation (the settled text a person actually read), not the raw event stream; the channel is a recorded binding, not a guess; and the baseline is taken at bind time so no backlog is ever replayed into a channel. The cursor advances even while the bot is off, and a binding whose session stops resolving is eventually released.

## Rationales

- Accepted MVP limit: chat models one live session per project and always routes to the newest.
- The chatbot and the notification watchers deliberately use separate transports — the bot speaks the API with its own token, notifications post to a plain webhook — so notifications work without a bot, and the bot works without webhooks.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
