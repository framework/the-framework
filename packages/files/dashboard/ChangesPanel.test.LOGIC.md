What the tests cover, for the Changes tab's list, rendered inside a fake dashboard with the module's reads stubbed:

- **An agent's list holds only what it changed** - with an agent [1] selected, the agent's tree is read and the project's files are not; the rows are the changed files alone, sorted by path, each with what happened to it ("deleted", "modified", "new") and "not committed" on the one that is only on disk; an unchanged file is not listed; the caption says the changes are not merged yet.
- **A file opens to its diff** - no diff is read while the rows are closed; clicking a row reads that file's diff for the agent and shows it.
- **A merged agent keeps its list** - an answer that says the work is merged still lists the changed file, captioned as merged.
- **Nothing, gone and still looking each say so** - an agent that changed nothing reads "This run changed no files."; one whose sources are gone shows the "gone from this machine" line; one whose answer is pending shows "Looking for this run’s changes…".
- **The project's own page** - with no agent selected, the project's read is made and no agent's tree; a file changed in the project's checkout [2] is listed under "Changed in the project’s folder, not committed." and opens to its diff, read for the project; with nothing changed the tab reads "Nothing is changed in the project’s folder."

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
