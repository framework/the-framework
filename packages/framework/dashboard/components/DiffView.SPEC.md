How a file is shown wherever the dashboard shows one: a changed file as its diff, an unchanged file as its contents, and a change's size as an added/removed pair.

## Business logic — TL;DR

- **One rendering, everywhere** - the file tree's hover card and the agent view's Changes section show a change with the same rendering, so the same change reads the same wherever the user meets it.
- **A changed file reads as a diff** - added lines in green, removed lines in red, the position markers highlighted, the rest plain; no syntax colouring.
- **An unchanged file reads as its contents with line numbers** - there is no added or removed line to colour, and the numbers are both what makes a plain body scannable and how the user refers to a spot ("line 40") when writing to the agent.
- **The dashboard shows, it does not edit** - nothing here can be typed into; it answers "what did the agent change" and "what is in this file", nothing more.
- **Honest about what it cannot show** - a file too long to send in full ends with a note that the rest is in the worktree, worded identically for a cut diff and a cut file; a file that is not text says only that there is nothing to show; an empty file says it is empty.
- **Change size** - the `+12 −3` pair used by the tree and the agent view alike, showing only the halves that are non-zero.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
