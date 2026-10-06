What the tests cover:

- **A repository with commits** - activation writes the ignore file and runs no git command that stages or commits.
- **The ignore file's rules** - everything under `.openagent/` is ignored, the ignore file itself included, since the lasting records live on the `agent-data` branch.
- **Against a real git repository** - after activation the repository's commits and its `git status` are exactly what they were, with the user's uncommitted and staged changes as they left them; activating again answers already activated.
- **Already activated** - a repository whose ignore file exists is a no-op reported as already activated, with no git command run at all.
- **A repository with no commit, against real git** - it gets one empty first commit, "[OpenAgent] first commit"; a file the user had staged is still staged and uncommitted, a loose file is still loose, and a branch can be started.
- **A git failure** - a failing git command is returned as a failure with its message, never thrown; when the first commit is what fails, no ignore file is written, so the repository is not activated.
- **Not a repository yet** - a folder outside any repository is initialized with git first, then given the empty first commit, made from git's empty tree and never from what is staged, and the answer says it was initialized.
