What the tests cover: an agent shows no status word until it has named its session, signalled ready for merge or ended; it reads "building…" while live and settles to "finished" when it ends cleanly, or "ready for merge" when it signalled that. How the agent ended always outranks what it said on the way — "stopped" and "failed" (carrying the failure's reason) both beat an earlier ready-for-merge signal.

Also covered: the publishing window — an agent that ended cleanly with its handoff armed reads "publishing…" until the handoff reports, and outranks ready for merge, since the merge is part of the handoff still running; the window never opens for an agent whose handoff was disarmed, one that never armed a handoff at all (so old archives predating the handoff mechanism don't read as forever-publishing), or one that did not end cleanly. Finally, resuming an agent starts a fresh segment: a resumed agent reads "building…" again and publishes again, so neither an earlier segment's completed handoff nor an earlier "stopped" ending holds the status word.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
