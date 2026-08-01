---
'@gemstack/the-framework': patch
---

"Trigger routine now" answers with the sweep's real outcome lines again: the RPC read the Telefunc request context after an await, which does not survive one, so every click fell back to the generic "The sweep ran." The reporter is now captured before the sweep runs.
