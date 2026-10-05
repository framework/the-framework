What the tests cover, for the Changes tab's list and its commits, rendered inside a fake dashboard with the module's reads stubbed:

- **An agent's list holds only what it changed** - with an agent [1] selected, the agent's tree is read and the project's files are not; the rows are the changed files alone, sorted by path, each with what happened to it ("deleted", "modified", "new") and "· not committed" on the one that is only on disk; an unchanged file is not listed; the caption says the changes are not merged yet.
- **The first file is picked by itself** - the first row of the list is the picked one and its diff is read for the agent, that one diff alone; clicking another row makes it the picked one, the first no longer, and reads and shows that file's diff.
- **The picked file leaves the list** - after a click on a file, a new read of the agent's tree that no longer lists it makes the first file the picked one again.
- **A click counts for its own run** - a file clicked on one run's page is not picked on another run's page whose list holds the same path: that run's first file is.
- **A merged agent keeps its list** - an answer that says the work is merged still lists the changed file, captioned as merged.
- **Nothing, gone and still looking each say so** - an agent that changed nothing reads "This run changed no files."; one whose sources are gone shows the "gone from this machine" line; one whose answer is pending shows "Looking for this run’s changes…".
- **The project's own page** - with no agent selected, the project's read is made and no agent's tree; a file changed in the project's checkout [2] is listed under "Changed in the project’s folder, not committed." and, picked by itself, has its diff read for the project; with nothing changed the tab reads "Nothing is changed in the project’s folder."

And the agent's commits:

- **Under the list of files** - the agent's commits are read for the agent; the "Commits" section shows their number and three rows: "All changes", picked, then the two commits, newest first, each with its subject and "short id · author · how long ago"; no commit's files are read.
- **A click on a commit** - the commit's files are read for the agent and are the only rows of the list; the caption is the commit's short id and subject, not "What this run changed. Not merged yet."; the diff is read for that commit; the commit's row is the picked one. A click on "All changes" brings back the caption, the three files and the diff read with no commit.
- **A picked commit that is no longer the agent's** - after a new read of the commits that no longer lists it, "All changes" is picked and the caption is back.
- **Commits that cancel out** - an agent with commits and no changed file still shows the "Commits" section, with "No change is left: the commits cancel out.", and never "This run changed no files."
- **The project's own page** - no commits are read and no "Commits" section is shown.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
- **The commits stay as the run ends** - while the tree read answers pending and the commits read answers none, the three rows and the picked commit's name stay.
- **Nothing said before the commits are read** - with no changed file and the commits read still out, the panel says "Looking for this run’s changes…", never "This run changed no files."; once the read answers one commit, it says the commits cancel out.
- **Remembered** - opened again for the same agent with the reads still out, the tab shows the list read last and no "Looking…" line, and reads again; opened for another agent, it shows the "Looking…" line and none of the first agent's files.
- **A file asked for from the chat** - the file asked for is the picked one, not the first, and its diff is read; a click on another row afterwards stands while the same ask is still handed; a new ask for the first file picks it again; an ask already taken is not taken again by a tab opened later, which picks its first file; with a commit picked, an ask goes back to "All changes" and picks the file there; a file asked for that the list does not hold leaves the first file picked. A file asked for by its whole path on disk picks the listed file that path ends with.
