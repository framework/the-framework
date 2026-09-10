What the tests cover, for the file hover card in the project panel's tree:

- **Nothing is read until the card opens** - a row that is not hovered reads nothing, so a tree of changed files costs no diffs for files nobody points at.
- **A changed file's diff** - the diff is read for the selected agent's [1] checkout [2] and rendered as its removed and added lines with the "+1" and "−1" counts; on the project home, with no agent selected, the project's own checkout is read.
- **A changed file with nothing to show** - a file the daemon has no diff for reads "No change to show."; a read that fails leaves the card at "Reading the diff…" rather than crashing; a binary file reads "Binary file, nothing to show."; a diff cut at the preview cap ends with "Cut here. The rest is in the worktree."
- **An unchanged file's contents** - an unchanged file reads its contents rather than a diff, numbered line by line, while a changed file still reads the diff and never the contents; an empty file reads "Empty file."; a binary file reads "Binary file, nothing to show."; a file longer than the preview cap ends with "Cut here. The rest is in the worktree."; an unreadable file reads "Nothing to show."

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
