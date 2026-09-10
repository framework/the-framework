Pumps an in-memory event stream, the one the daemon holds for an agent relayed [1] from a device [2], to the browser: everything the stream has buffered is replayed first, then each event is forwarded as it arrives, until the stream runs out on its own or the browser leaves.

## Glossary

[1] relay: Running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[2] device: Another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.

## Business logic — TL;DR

- **Replay, then follow** - a browser joining mid-agent gets the buffered history, then the live events, each forwarded exactly once.
- **The end is reported** - when the stream runs out on its own (the relayed agent finished) the consumer is told, so the response can be closed instead of staying open forever on a stream that is already over.
- **Stopping releases everything** - stopping halts the forwarding, cancels the follower waiting on the next event, and delivers nothing more; stopping twice is harmless, and an absent stream is a no-op.
