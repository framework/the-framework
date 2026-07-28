---
'@gemstack/the-framework': patch
---

The session un-ignore rules in `.the-framework/.gitignore` are now user-agnostic globs, so the file is written once instead of once per person. Every user who ran a session appended their own three `!<email>/...` lines to a tracked file: their checkout went dirty, the next safety commit swept the edit into a branch, and two machines doing it near each other conflicted on a delete-vs-modify. One `!*/sessions/**` rule covers everyone, including people who have not run anything yet. A file that still names users is upgraded to the glob form in place, in the same write that removes the per-user lines, and a file already on the glob form is never written again. Unrelated rules, including the conversations rules, are kept exactly as they are.
