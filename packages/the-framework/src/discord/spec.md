Discord as a chat surface for sessions: read messages from a channel, act on them exactly as a dashboard click would, and mirror the session's answers back.

## TLDR

- Inbound: a minimal hand-rolled Discord gateway client feeds pure routing rules — given a message and a snapshot of the project's state, decide what it means: answer the parked question (by option number or label), send the session a message, start a session, stop one, or just reply. The chosen action goes through the same control channel as a dashboard click, so the session can't tell the difference.
- Outbound (the reply mirror): a session's answers are posted back to the channel that asked. The source is the committed conversation — the settled text a person actually read — not the raw event log; the channel is a recorded binding, not a guess; and the baseline is taken at bind time so no backlog is ever replayed into a channel. The cursor advances even while the bot is off, and a binding that stops resolving is eventually released.
- Accepted MVP limit: chat models one live session per project and always routes to the newest.
- Deliberately separate transports: the chatbot uses the bot-token API, while the notification watchers post to a plain webhook — notifications work without a bot, and the bot works without webhooks.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
