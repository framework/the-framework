What the tests cover, for the project panel's file tree:

- **Whose files the tree shows** - with no agent [1] selected the file statuses are read for the project's own checkout [2] and the agent's tree is not asked for; with an agent selected the tree is that agent's own, its files replacing the project's and the project's statuses not asked for; switching to another agent reads that agent's tree afresh instead of keeping the previous marks.
- **A changed file is marked, committed and uncommitted apart** - a file modified only on disk reads "modified, not committed", a file a commit added carries "A" and reads "added, committed", and the caption says the tree is from the agent's checkout.
- **Where a finished agent's tree comes from** - an agent read from its branch is captioned "From branch <branch>", one read from its merge commit "From the merge of #<number>".
- **Gone says so** - an agent none of whose sources is left shows the "changes are gone" line, and not the project's files.
- **Clicking picks** - clicking a file reports its path to be toggled in the Context [3], and a file already in the Context shows tinted.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[3] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root.
