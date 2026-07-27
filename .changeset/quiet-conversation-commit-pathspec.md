---
'@gemstack/the-framework': patch
---

The conversation committer only passes the pathspecs that actually have something pending. A project with no `.the-framework/conversations` directory — every project until its first recorded chat — made `git add`/`git commit` abort with "pathspec ... did not match any files", so its sessions never committed and the daemon log carried that failure on every poll. Nothing to commit under a pattern is now the ordinary skip it always was, while real git failures are still reported.
