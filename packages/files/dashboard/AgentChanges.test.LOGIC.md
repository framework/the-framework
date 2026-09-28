What the tests cover, for the panel of files a running agent has changed:

- **The list** - the agent's changed files are read from its own checkout by the agent's id and listed by name, each with its state ("modified" for a changed file, "new" for an untracked one).
- **The count reaches the bar** - the number of files and the totals of lines added and removed (two files, 13 added, 1 removed) are reported upward even while the panel is collapsed, when no rows are shown; the bar's summary then reads "2 files" with "+13".
- **Nothing changed** - an agent that changed nothing renders nothing at all, reports zero, and offers no "Changed files" section.
- **Diffs on demand** - no file's diff is read until its row is expanded; expanding a row reads that file's diff from the agent's checkout and shows it.
- **A failed read** - when the read fails, the panel stays silent instead of throwing.
