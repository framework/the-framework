The checkout-in-play status line — active branch, a clean/dirty dot, the linked PR — shared by the project home and the session page, so the same facts cannot drift into two looks.

## TLDR

- On a session it reports that session's own worktree, adding what only a worktree has: its size on disk, and honesty that uncommitted changes there are the agent's, not yours.
- Refreshed on a slow cadence, but sped up while a PR lookup is still settling, so that answer appears in seconds rather than after a full cycle; nothing renders when there is no checkout to report.
- The session's name leads and truncates last — it is the stable identity, where the branch gets renamed by the agent — and other facts drop out whole as the bar narrows rather than squeezing.
- Clean is deliberately neutral, not green: green means "changed/added" one pane away, and a clean tree has nothing to announce.
- It can double as the disclosure for the branch detail below it, so a session's branch is spoken about in exactly one place.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
