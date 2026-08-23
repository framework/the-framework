What the tests cover: which log the live feed follows, how it behaves when it dies, and how it protects what is already on screen.

- **Addressing** - the feed follows the agent it was given; selecting another agent switches to that agent's log so two agents never share a feed; with no agent named it follows the project's own log instead.
- **Loss and recovery** - a feed that dies mid-stream is reported as lost, resubscribes on its own and recovers; a feed the daemon closes cleanly neither alarms nor retries; and a subscription that fails outright is also reported as lost and keeps trying until it succeeds.
- **Scoping** - an agent's own feed keeps everything, including the transcript from before a resumed agent's second session boundary; the project-wide fallback feed still trims to the newest session, because it genuinely spans several agents.
- **Reconnect without shrinking** - the first subscription streams straight onto the screen and its end-of-replay signal is never shown as an event; on a reconnect the populated feed stays put while the replay re-streams out of sight and is then swapped in whole, never as a shorter prefix, with live events continuing after it; a source that never sends an end-of-replay signal still swaps at the grace deadline instead of freezing; and a reconnect that dies part-way through its replay throws the partial replay away, leaving the previous content intact until a later attempt replays in full.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
