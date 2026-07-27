---
"@gemstack/the-framework": patch
---

A running session's PR badge no longer flashes a predecessor's merged PR: run-scoped git-status reads pick the PR from the branch's history with the run's own start as the cutoff, instead of trusting the newest PR in any state. A reused pinned branch (`the-framework/triage-quick`) previously dressed every new run in the last closed PR's badge.
