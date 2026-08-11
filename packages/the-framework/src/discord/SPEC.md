Discord as a chat surface for sessions: read messages from a channel, act on them exactly as a dashboard click would, and mirror the session's answers back.

## TLDR

- Inbound: a minimal hand-rolled Discord gateway client feeds pure routing rules — given a message and a snapshot of the project's state, decide what it means: answer the parked question (by option number or label), send the session a message, start a session, stop one, or just reply.
- Outbound (the reply mirror): a session's answers are posted back to the channel that asked.
- Accepted MVP limit: chat models one live session per project and always routes to the newest.

## Flows

- **A channel message arrives**: the routing rules pick an action, and it goes through the same control channel as a dashboard click, so the session can't tell the difference.
- **A session answers**: the reply mirror posts the settled text back to the recorded channel, advancing a cursor so nothing posts twice.

## Rationales

- The mirror's source is the committed conversation — the settled text a person actually read — not the raw event log.
- The mirrored channel is a recorded binding, not a guess; the baseline is taken at bind time so no backlog is ever replayed into a channel; the cursor advances even while the bot is off; and a binding that stops resolving is eventually released.
- The chatbot and the notification watchers deliberately use separate transports — bot-token API vs. plain webhook — so notifications work without a bot, and the bot works without webhooks.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
