What the tests cover:

- **A clean repository** - activation writes the ignore file and makes exactly one commit, "[The Framework] install The Framework".
- **The ignore file's rules** - everything under `.the-framework/` is ignored except the ignore file itself, since the lasting records live on the `agent-data` branch.
- **A dirty repository** - the user's uncommitted changes are left alone: only the `.the-framework` directory is staged, never everything, and the one install commit is the only commit made.
- **Already activated** - a repository whose ignore file exists is a no-op reported as already activated, with no git command run at all.
- **A git failure** - a failing git command is returned as a failure with its message, never thrown.
- **Not a repository yet** - a folder outside any repository is initialized with git first, then activated and committed, and the answer says it was initialized.
