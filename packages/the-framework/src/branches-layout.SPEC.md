Keeps every project on the flat branches layout: agent checkouts live at `.the-framework/branches/`, each directory named as its branch, with a `branches` shortcut at the repo root pointing there.

## TLDR

- Every agent gets its own checkout, and this is where they all live now: one flat directory whose entries read as branch names, so a person can `cd branches/<name>` straight into any session's work.
- Checkouts created before this layout existed sit in the old spot where nothing looks anymore. The daemon moves them over in the background, through git so git keeps tracking them.
- Two things are never touched: a checkout whose agent is still running (moving the floor under a live run breaks it), and anything already sitting at the root `branches` path — a user's own file or directory stays theirs.
- Anything that cannot be moved simply stays put and is retried on a later pass; the pass says what it moved and why something stayed.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
