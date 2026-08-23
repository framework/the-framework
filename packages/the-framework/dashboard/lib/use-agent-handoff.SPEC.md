What the agent view knows about handing an agent's work off — what is already pushed, whether a PR exists, whether it can be merged — and how the Push, Open PR and Merge buttons act on it.

## Business logic — TL;DR

- **One answer, two places** - the agent's summary and its action bar (including the commits-and-files detail the bar expands) read the same answer, so they can never disagree and the daemon is asked once instead of twice.
- **Nothing while the agent is still running** - a branch still being written to has nothing to hand off, so the question is not asked at all until the agent is finished; it is also skipped for views that do not need it.
- **Refreshed every fifteen seconds** - a push or a PR opened elsewhere, including from a terminal, changes what should be offered, so the answer is re-read rather than read once.
- **A PR that has not surfaced yet is chased once a second** - while a just-requested PR is still pending, the Push and Open PR offers are held back, so the answer is asked for again every second until it appears, then the pace drops back to fifteen seconds.
- **The last answer stays on screen** - it is kept while the pace changes and while a fresh read is in flight, so the summary never blanks out and the action bar never flickers back to stale numbers.
- **The button in flight says so** - the specific action running is known, so it can read "Pushing…" instead of silently greying out, and a successful action immediately re-reads the handoff state rather than waiting for the next refresh.
- **No empty-state flash** - the view knows whether the first answer has arrived, so it does not briefly claim there is nothing to hand off.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
