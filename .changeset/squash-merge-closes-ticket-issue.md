---
'@gemstack/the-framework': patch
---

A run implementing a ticket now carries the ticket's GitHub issue into its PR title as `(fix #42)`, read off the ticket's `GitHub:` header (#1334). The squash-merge commit inherits the title, so merging the PR closes the issue — before, an autonomously merged quick-win left its ticket open.
