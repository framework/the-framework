---
'@gemstack/the-framework': patch
---

The dashboard shows what the daemon finds wrong with a project (#1500): a per-project error state the daemon's background jobs set and clear, carried on the project list and rendered as a red dot in the sidebar and a banner on the project's page. The first emitter is the data-branch sync (#1599): a push origin rejects, or a repository with no remote at all, is an error the user sees now rather than a line on the daemon's stdout — cleared by the first sync that converges.
