What the tests cover, for the project panel's file tree:

- **Whose checkout the verdicts describe** - with no agent [1] selected the file statuses are read for the project's own checkout [2]; with an agent selected they are read for that agent's checkout; switching to another agent reads that agent's checkout afresh instead of keeping the previous dots.
- **A changed file is marked** - a file the agent modified carries the letter "M".
- **Clicking picks** - clicking a file reports its path to be toggled in the Context [3], and a file already in the Context shows tinted.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[3] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root.
