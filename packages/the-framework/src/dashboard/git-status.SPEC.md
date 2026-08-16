A project's git status for the panel: the current branch, whether there are uncommitted changes, and the pull request linked to that branch.

## TLDR

- Branch and dirtiness are instant local reads; the PR is the slow lookup, served through the cache and allowed to arrive late as "not known yet" rather than holding the row back on every poll.
- Read for an agent's checkout, the PR is attributed using the agent's start time, so a reused branch does not show a predecessor's merged PR as the agent's own.
- Forgiving throughout: not a git repo reads as no status, and a failed PR lookup simply omits the PR.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
