The agent-views rail panel (#441, part of #314): the ad-hoc markdown the agent pushed via `showMarkdown()` (plans, summaries, writeups), each a first-class view with a sticky top-nav.

## TLDR

- Views arrive over the live event stream and update in place when re-shown; unlike choice gates they never block the run.
- A newly pushed view (unseen id, tracked in a `known` ref) selects itself (#948) — the rail's tab badge only counts, so view 3 landing while you read view 0 used to be invisible; re-shown views update without stealing the selection.
- Selection clamped to `views.length - 1` since a new run can truncate the stream; top-nav only when >1 view; each view carries a `CopyButton` (a view is copy-bait — the plan/summary you paste elsewhere).
