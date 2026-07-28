---
'@gemstack/the-framework': patch
---

An armed auto-merge (#1216) now opens its PR ready instead of draft — GitHub refuses to merge drafts, so the merge half always reported failure. A draft found on the already-open path is marked ready and retried.
