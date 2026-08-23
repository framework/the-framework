What the tests cover: reading an agent's live status off its event log.

- **Agent views** - views are listed in first-seen order with one entry each; re-showing a view under the same identity updates it in place instead of stacking a duplicate; unrelated events are ignored; and a newly added detail on a view carries through untouched.
- **Open gates** - an unanswered gate is pending and an answered one is not; several gates can be parked on at once, in fire order; the agent's end expires every gate open at that point, while a gate asked after it opens fresh.
- **Still working** - nothing streamed yet is not active, streamed-but-unended is, ended is not; and a resumed agent is active again, its earlier stretch's end not counting against it.
- **Publishing** - the window opens on a cleanly ended agent whose handoff was armed to push, and any handoff report — done, skipped or failed — closes it; there is no window without an affirmative arming, with the push rung off, or after an unclean end; a resumed agent gets its own window, which the earlier stretch's handoff report does not close while its earlier arming still counts. The same rules hold when read from an agent's `agent.json` instead of its event log: open between a clean finish and the recorded handoff report, closed while running, after an unclean end, or with no push armed.
- **Current segment** - a log with no session boundary yet is taken whole; a single stretch is kept intact; once a new agent opens, the previous one is dropped, and a just-finished second stretch keeps its own ending rather than the first one's.
- **How it ended** - no outcome while still going; a clean finish, a failure carrying its detail, and a user stop are told apart; a resumed agent has no outcome until its own stretch ends, and then reports that stretch's result.
- **Actions run link** - the live GitHub Actions run link is recovered from the driver's progress line, is absent before the driver reports it, is not confused with an ordinary tool step, and the most recent one wins across turns.
- **Settled** - an agent parked on the user counts as settled even though its process is still up; a new turn un-settles it and settling again re-parks it; an agent that ended outright is not settled.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
