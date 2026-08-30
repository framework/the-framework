What the tests cover: reading and editing the queue, both as pure text and against real git.

- **The open entries** - list items with any marker, a task item only while unchecked, and headings, prose, blank lines and empty items skipped.
- **The priority sections need no parser support** - a priority-sorted file reads back in priority order.
- **Taking an entry off** - the named open entry is deleted and nothing else; an entry that is not there changes nothing, and a checked line is not an open entry.
- **Adding without a priority** - a plain bullet at the end, whether the file is empty, ends in a newline or does not.
- **Adding with a priority** - the entry lands in its own `## Priority N` section, between the higher and the lower ones; it joins an existing section at its end rather than creating a second one; an entry that outranks everything goes first and one outranked by everything goes last in a new section; a file with no priority sections gets one above its own headings, with its intro left at the top; a heading carrying the format's own gloss is still matched.
- **Against real git** - an empty queue on a project with no branch yet; entries added from the project root and from an agent's checkout land on the same branch, each as one commit named after what it did; an entry taken off is deleted rather than checked off; an entry already gone is a landed no-op; and a queue written by hand through the branch's write cycle reads back the same way.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
