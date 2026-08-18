The right sidebar: tabs for the project's files, the documents the agent pushed up as it worked, the live browser view, and the workspace docs — every tab earned by its content.

## TLDR

- A tab that could only say "nothing yet" is not offered, and a rail with no tabs left is not shown at all; while a first read is still out the tab stays, so switching projects does not blink the rail.
- Only the first pushed view pulls focus; after that an explicit pick is never overridden, and a tab that loses its content falls back to one that still has some.
- The browser tab appears only when the agent actually drives a browser — never for agents executing somewhere no browser exists.
- While the launcher shows the docs in its own column, the rail withholds that tab.
- It had a History tab too, rendering a committed markdown re-narration of what the agent archive already holds exactly; the agents themselves are the history.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
