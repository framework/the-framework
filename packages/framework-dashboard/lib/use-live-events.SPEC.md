The live transcript feed: one subscription to the selected session's own event log, replayed from the top and then followed as it grows, shared by every pane that renders it.

## TLDR

- The feed is addressed per session, so selecting another session switches to that session's log — two sessions never share a feed.
- A dead stream is not silent: an errored drop flags the feed as possibly behind reality and retries with backoff, while a deliberate close by the server (watch stream over, unknown session) simply ends it, no alarm.
- On a reconnect the pane never shows less than it already showed: the fresh replay is held back and swapped in whole once complete, so recovery is a catch-up rather than a blank-and-refill — and a replay cut short is discarded, never swapped in.
- Starting a new session clears the pane at once, so the finished session's transcript is not shown while the new one spins up.
- A session's own feed keeps its pre-resume transcript; only the project-wide fallback (used when no session is addressable) trims itself to the newest session.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
