---
'@gemstack/the-framework': patch
---

A run whose driver dies to a transient transport error (connection closed mid-response, reset, timeout, overload, 5xx) is no longer lost: the daemon continues the same run in its retained worktree, on its recorded branch, up to twice with a short pause, using the same continue-run machinery that resumes runs after a daemon restart. The queue pin and agent session ride along, so a retried drain keeps its claim and its context. A run that fails on its own terms, or keeps dying after the retries, stays failed.
