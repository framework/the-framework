What the tests cover, for the line of git facts about the checkout [1] in play:

- **Whose checkout** - on the project home the project's own checkout is read, showing its branch and "clean", and no agent's [2] checkout is asked for; with an agent selected that agent's checkout is read instead, showing its branch, "dirty", and what only an agent's checkout has, such as its size on disk ("5 MB").
- **The pull request** - an agent's branch's pull request shows as "PR #42" with its state "open", the way the project's does.
- **No size while unmeasured** - when the daemon has not measured the checkout's size, no placeholder appears where the number would go.
- **Nothing to report** - when the daemon has no checkout to report, the line renders nothing.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
