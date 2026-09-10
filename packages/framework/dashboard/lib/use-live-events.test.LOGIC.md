What the tests cover:

- **Which stream is followed** - the feed follows the agent it was given, so two agents never share one feed; selecting another agent switches to that agent's stream; with no agent selected it follows the project's stream instead.
- **A lost stream is reported and retried** - a stream that ends with an error, and a subscription that fails to open at all, both mark the feed as lost and reconnect on their own until the stream is back, at which point the lost mark clears.
- **A stream the daemon ends on purpose** - a clean end neither marks the feed as lost nor reconnects.
- **What the feed is cut to** - an agent's own stream is shown whole, including everything recorded before a resume; the project-wide stream is cut to the agent in progress, so a previous agent's lines never show under a new one.
- **Replay then live on the first subscription** - the first subscription's events render as they arrive, and the end-of-replay marker itself is never shown as an event.
- **A reconnect never shows less than it already showed** - while a reconnected stream re-sends the recorded events, the feed on screen stays untouched, then the whole replay replaces it in one step at the end-of-replay marker, after which new events append again.
- **A stream that reports no end of replay** - the held-back replay is swapped in at a deadline instead, so a relayed agent's feed never freezes.
- **A reconnect that dies mid-replay** - the partial replay is discarded rather than swapped in, the feed on screen survives both drops, and the next attempt replays and swaps in full.
