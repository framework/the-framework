What the tests cover, for the project panel's file tree:

- **Whose checkout the verdicts describe** - with no agent [1] selected the file statuses are read for the project's own checkout [2]; with an agent selected they are read for that agent's checkout; switching to another agent reads that agent's checkout afresh instead of keeping the previous dots.
- **A changed file is marked** - a file the agent modified carries the letter "M".

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
