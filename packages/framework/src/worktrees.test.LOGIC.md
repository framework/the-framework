What the tests cover, against real git with a bare repository standing in for the remote, the `branches` skill's package installed as the project's branches provider (`store/test-branches.ts`):

- **Only what is on the remote may go** - with no remote at all, a checkout holding committed work is kept, the refusal says the branch is not on the remote, and the work is still on disk.
- **A directory git does not know as a worktree** - is refused before any git command runs in it: nothing is committed on the user's own checkout, the user's uncommitted edit survives, nothing is pushed, and the directory is left where it is.
- **The birth branch** - when the agent branched away to a named branch and committed there, removal pushes the named branch, deletes the birth branch, and reports that deletion.
- **An unknown agent** - an id with no checkout is refused in the provider's words, "no checkout for agent <id>", and the real checkout is untouched.
- **No provider** - a project none of whose packages provides its checkouts has nothing to remove, and says so, the checkout untouched.
- **Deleting an agent** - an agent that has only its record, its checkout already gone, is deleted cleanly through the project's runs provider (the `logs` skill's package, installed as a dependency) and the record is gone, and deleting it again still finishes cleanly; an agent whose checkout holds uncommitted work loses the checkout, work and all, while its branch stays and nothing is pushed; an id that is not a safe agent id is refused before anything is touched.
