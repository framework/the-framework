Automatically reclaims a finished session's checkout once its work has landed — the branch, the commits, and the session's history are kept, so only disk is freed.

## TLDR

- Landed means merged into the base locally, or the pull request was merged on GitHub; the second signal exists because a squash merge rewrites commits and hides from the first.
- Conservative wherever the answer is unclear: a live session, a vanished branch, an unreadable repo, or a run that did not finish cleanly all keep their checkout.
- A closed-but-unmerged pull request means rejected work — the checkout a human most wants to read — and is never removed.
- Every project is swept every ten minutes and once at startup (for machines that were off when the merge happened), and each removal is announced so it never reads as a bug.

## Rationales

- Removal reuses the same operation as the dashboard's Remove, so uncommitted leftovers are committed to the kept branch first — everything deleted stays reconstructable from git.
- A run that died at boot leaves an empty branch that looks merged; only its recorded outcome tells it from a real success, so the local signal alone reclaims cleanly finished runs only.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
