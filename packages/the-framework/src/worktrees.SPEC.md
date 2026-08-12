Lists and cleans up the per-session checkouts a project retains — one implementation behind both the CLI verbs and the dashboard buttons, so the two surfaces cannot drift.

## TLDR

- A checkout is retained exactly when its run failed or was stopped — precisely when it still holds uncommitted agent work — so removing it first commits that work to the session's branch and refuses when the commit fails, rather than deleting the very diff it was kept for.
- Deleting a session goes further: its archived records leave the dashboard for good and uncommitted work is discarded with the checkout — but the branch, its commits, and the conversation record stay, because silently deleting a branch that may carry merged work or an open PR is not a dashboard's call.
- Both refuse while the run is live: Stop is how a run ends, not pulling the floor out from under it.
- The prune sweep removes every non-live checkout and reports each skip with its reason; a live checkout is listed and flagged rather than hidden, since "what is this directory and why can I not remove it" is exactly the question the list answers.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
