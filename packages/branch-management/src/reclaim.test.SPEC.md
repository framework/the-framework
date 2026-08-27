What the tests cover: reclaiming a checkout, checked against real git because "was the work actually destroyed" and "did the branch survive" are the whole subject.

- **Nothing local is ever the last copy** - a checkout holding an uncommitted edit is kept as dirty, with nothing committed or pushed on its behalf; a checkout whose agent committed its edit is reclaimed once the branch is pushed, and afterwards the edit is readable on both the branch and the remote.
- **Unrecoverable means untouched** - with no remote configured a committed checkout is kept, the reason says it is not on the remote and carries what git said.
- **A push the caller forbids** - the same checkout is kept while dirty, kept once committed but unpushed with nothing reaching the remote, and reclaimed once someone pushed the branch by hand.
- **A checkout held by a pushed commit** - a clean tree whose tip is inside the stated commit is reclaimed with no push at all, so no branch reaches the remote.
- **A branch that holds nothing goes unpushed** - a branch whose tip the remote already has under another name is deleted with its checkout and never pushed; a clean checkout carrying a commit the remote has never seen is pushed instead and keeps its branch; a branch pushed under its own name keeps its local copy rather than reading as empty; a leftover checkout on a branch not minted for an agent keeps that branch, empty or not, while its birth branch goes; a branch renamed after it was pushed is pushed under its new name and kept, never read as empty.
- **A directory that is not a git worktree** - refused before any git runs in it: the user's uncommitted edit is untouched, nothing is pushed, and the directory is left where it is.
- **The birth branch** - an agent that branched away onto its own `tf-<session name>` branch loses the birth branch its checkout was created on, never pushed, while the branch it worked on stays and is pushed; an agent that commits nothing at all loses both branches and pushes neither; a birth branch carrying a commit the kept branch lacks stays.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
