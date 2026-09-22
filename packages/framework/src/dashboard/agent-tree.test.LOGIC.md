What the tests cover, against a real git repository with worktrees, branches and merges made for the test:

- **A live checkout** - the tree lists the checkout's files, a file the agent [1] deleted in a commit included; a file changed in a commit is marked committed, a file changed on disk is marked not committed, and a file changed in both keeps the uncommitted mark; a committed file's diff runs from the fork point [2], an uncommitted file's against the last commit, and an unchanged file has none.
- **A local branch** - with no checkout, the agent's branch is read: its files at its last commit, what it added, modified and deleted marked committed, a file's diff and a file's content as the branch holds them; an unsafe path is refused.
- **Origin's copy of the branch** - a branch only origin's copy holds is read from it.
- **A squash merge** - once the branch is gone, the commit the agent's pull request merged as is read, with that commit's own change marked.
- **A true merge** - a branch the default branch already contains is read from its merge commit instead; with no merge commit to read, the branch still answers.
- **Gone** - an agent whose branch never reached this machine, an agent that recorded no branch, a merge commit this machine has not fetched, and a pull request on the branch whose number is not the agent's all answer gone.
- **Still looking** - while the pull request lookup has not answered and there is no branch, the answer is that it is not known yet.
- **A file deleted on disk** - has no content to show.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch.
[2] fork point: the commit where an agent's branch left the project's default branch.
