A minimal, hand-rolled Discord connection: the inbound half of the integration, listening for the chat messages a notification webhook could never read.

## TLDR

- Deliberately no Discord client library: the handful of protocol steps a chat bot needs (identify, heartbeat, resume) is tiny next to the dependency a library would add.
- A dropped or unresponsive connection reconnects by itself, resuming the session when possible, with a doubling wait so a dead network or bad token never becomes a tight retry loop.
- Messages from bots — our own above all — are never acted on: two bots answering each other is an unbounded loop that costs real money.
- Discord silently delivers empty message text unless a privileged permission is enabled for the bot; that trap is named in the log instead of failing silently.
- Errors are logged, never thrown, and stopping is final: shutting the daemon down takes the bot offline with no reconnect.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
