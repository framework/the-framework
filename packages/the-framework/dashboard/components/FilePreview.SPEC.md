Pointing at a file in the file tree shows what is in it, in a card beside the tree.

## Business logic — TL;DR

- **Pointing, not clicking** - clicking a file in the tree already means something else (it puts the file into the agent's Context), so pointing at it is the gesture that reveals its content. A short pause before the card appears keeps it from flashing while the user sweeps down the tree, and the card stays open while the pointer travels into it, so a long body can be scrolled and read.
- **Changed file, diff; unchanged file, contents** - the tree already knows each file's git status, so it asks for the right one directly instead of having the daemon look the status up again. A changed file's card also carries its added/removed counts.
- **Read from the agent's own checkout** - what the card shows is the file as the selected agent has it, not as the main checkout has it.
- **Nothing is fetched for a file the user never points at** - the card only reads once it is actually shown.
- **It keeps up with the agent** - the card re-reads every few seconds, so a file being edited under the pointer stays current instead of freezing at what it was when the card opened.
- **Loading and empty are different facts** - the card says it is reading first, and only then reports that there is no change (or nothing) to show.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
