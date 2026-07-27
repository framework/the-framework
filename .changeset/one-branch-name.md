---
'@gemstack/the-framework': patch
---

A run's branch is recorded on its meta from the start, and updated when the framework renames the run-id branch after the agent names the session, instead of being stamped only at teardown. Continuing a run re-attaches the recorded branch, so a run whose agent created its own branch is no longer continued on a branch without its previous commits.
