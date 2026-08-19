---
'@gemstack/the-framework': minor
---

The layout gate (#1575): a build refuses to run in a repo whose committed layout marker records a different bookkeeping layout, instead of committing files under names the repo no longer uses. Install records the marker; the repo's own is pinned to the build by a test, so a layout rename cannot land without regenerating it.
