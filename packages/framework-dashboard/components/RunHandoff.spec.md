The end-of-session handoff surfaces (#799): what the session produced and the next step, split across the action bar (summary, arm checkbox, action button) and the bar's disclosure (commits + files).

## TLDR

- `HandoffSummary`: one-line verdict in the bar — "branch gone" / "no changes" / "N commits · M files ±stat", plus `· pushed` (only when no PR — the bar already links the PR) and `· merged`.
- `HandoffArm` (#1102): the live session's pre-commitment — whatever is ticked when the session settles happens by itself (push/PR), defaulting on so work stops arriving on a local branch nobody was told about (#860). Live sessions only.
- `HandoffActions`: the post-settle button — a single "Open PR" (opens the PR, pushing on the way), or "Merge PR" once an open unmerged PR exists (#1391: the human's answer to the withheld-merge ending, #1363); every no-button state says why instead (`Reason`): branch gone, nothing committed, no remote (#1173).
- `RunHandoffDetails`: the disclosure's commit list (capped `MAX_COMMITS = 6`) and file list (capped `MAX_FILES = 10`), remainder counted ("and N more"); `handoffExpandable()` gates the disclosure (exists && !empty).
- The read is branch-addressed, so it survives worktree removal (a clean run's worktree is deleted when it ends).

## Decisions

- One checkbox and one button, not two (#1173): "Push branch"+"Open PR" sat as equals and nobody could put a purpose to pushing without a PR; opening a PR pushes on the way, so the outcome-naming control stays. A push-only session (still settable in Settings) relabels the box "Push branch" — the box never describes something other than what will happen. A merge-armed session (#1382) relabels it "Open PR & merge" for the same reason: merge has no checkbox (#1216), but a box saying "Open PR" about a run that lands on main by itself is the lie the label rule exists to prevent.
- `HandoffArm` holds a `pending` optimistic state until the event stream echoes the click back: the instruction round-trips through a file the run tails, so rendering the stale value would flick the box under the cursor (same shape the quota slider needed for a polled value, #979).
- Unticking the one box disarms both push and PR (`sendSetHandoff(p, r, false, false)`) — it no longer leaves the push quietly armed.
- `HandoffActions` returns null while `handoff.prPending` (#1028): acting on "not known yet" is how a second PR gets opened. An existing PR withdraws the Open PR offer ("the single mistake this must not make"; the interventions queue #632 has it by then) and becomes the Merge PR button while open and unmerged — `sendMerge` merges it directly, marking a draft ready on the way.
- `empty && pending > 0` still offers Open PR: the agent commits what it found before starting and nothing at the end, so its whole output routinely sits uncommitted in the tree — opening the PR commits it first (#1173).
- Details omit the branch name — the action bar it sits under already says it (#1023).

## Facts

- `RunHandoff` fields used: `exists`, `empty`, `pending`, `hasRemote`, `pushed`, `merged`, `pr`, `prPending`, `commits[{sha,short,subject}]`, `files[{path,insertions,deletions,binary}]`, `insertions`, `deletions`.
- Controls call `sendSetHandoff` / `sendOpenPullRequest` telefuncs; `RunHandoffState` (busy/pending/act) comes from `../lib/use-run-handoff.js`.
