What the tests cover, for the Files tab's tree, rendered inside a fake dashboard with the module's reads stubbed:

- **Whose files the tree shows** - with no agent [1] selected the project's own files and statuses are read (its checkout [2]) and the agent's tree is not asked for; with an agent selected the tree is that agent's own, its files replacing the project's and the project's read not made; switching to another agent reads that agent's tree afresh instead of keeping the previous marks.
- **A changed file is marked, committed and uncommitted apart** - a file modified only on disk reads "modified, not committed", a file a commit added carries "A" and reads "added, committed", and the caption says the tree is from the agent's checkout.
- **Where a finished agent's tree comes from** - an agent read from its branch is captioned "From branch <branch>", one read from its merge commit "From the merge of #<number>".
- **Merged shows a plain tree** - an agent whose answer says its work is merged shows its files with nothing marked, though the answer names a changed file, captioned "Merged: nothing waiting. What it changed is under Changes." and not with its source; the same answer not merged marks the file and is captioned with its branch.
- **Changed nothing says so** - an agent that changed nothing shows the project's files with nothing marked, captioned "This run changed no files", and not the "changes are gone" line.
- **Gone says so** - an agent none of whose sources is left shows the "changes are gone" line, and not the project's files.
- **Only open folders are built** - a closed folder's files and subfolders are not on the page; opening it shows its direct files but not a closed subfolder's, and closing it takes them off again.
- **Clicking picks** - clicking a file asks for its path to be toggled in the Context [3], and a file already among the Context's files shows tinted.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[3] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root.
- **Starting says so** - an agent still looked for shows "Looking for this run’s changes…", and one starting here shows the project's files captioned "Starting from the project’s files"; either shows the agent's own tree within seconds once it has one, well before the regular poll.
- **Remembered** - opened again for the same agent with the read still out, the tree read last is there and no "Looking…" line.
- **The agent doing something** - a new event in the agent's feed reads the tree again at once, well before the regular poll.
- **Files moving** - an agent whose tree was shown and which then answers pending keeps its tree on screen, with no "Looking…" line.
