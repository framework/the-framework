What the tests cover: nothing is read until the card is actually shown, so a tree full of changed files costs no reads for files nobody points at; the card reads the selected agent's own checkout, and the project's own checkout when no agent is selected; a changed file is shown as its diff with its added/removed counts, and an unchanged file as its contents with numbered lines — each asking for only the one read it needs.

The edge cases are pinned too: a file with no change and an unreadable file each say so instead of sitting on the loading message; a file that is not text says there is nothing to show rather than rendering bytes; a file cut short says it was cut; an empty file says it is empty; and a read that fails leaves the card on its loading message rather than surfacing as an unhandled failure.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
