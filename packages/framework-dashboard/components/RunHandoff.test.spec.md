Tests for `RunHandoff.tsx` (#799/#1102/#1173) — exercises the same composition RunView uses (summary + actions in the bar, details behind the disclosure) via a harness around `useRunHandoff`.

## TLDR

- Summary/details: counts collapsed, lists expanded, branch name never repeated (#1023), nothing rendered before the first read (no wrong empty-state flash).
- Dead ends say why (#1173): "no changes" → "Nothing committed — no PR to open."; branch gone → its own sentence; no remote → "No remote to push to."; but `empty` with `pending` tree work still offers Open PR.
- One button: Open PR only (never Push branch), calling `sendOpenPullRequest`; an existing PR withdraws the offer (#632); action failures surface their error string.
- HandoffArm (#1102): one checkbox; unticking sends `(false, false)`, ticking sends `(true, true)`; push-only state labels it "Push branch"; the click holds against a stale rerender until the run echoes it back (no bounce).
