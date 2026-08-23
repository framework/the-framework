The floating menu the prompt editor's typed triggers open: the filtered list of entries, and how the user moves through it and picks one.

## Business logic — TL;DR

- **Keyboard first** - the arrow keys move the highlight, wrapping around at both ends; Enter or Tab picks the highlighted entry. Every other key goes back to the editor, so typing keeps narrowing the list.
- **Mouse too** - hovering an entry highlights it and clicking picks it, without the editor losing the caret's place.
- **Entries carry a label and a hint** - the hint says what kind of entry it is (for example "saved preset", "project", "file"); entries can be grouped under a section heading, and consecutive entries of one group share a single heading. An entry whose label and hint do not make its effect obvious carries an explanation on hover.
- **An empty source explains itself** - a trigger that opens with nothing to offer shows its own note ("No projects to reference yet.", "No files indexed here yet.") instead of a blank menu that looks broken. A query that simply matches nothing just closes the menu.
- **The highlight is announced** - the menu reads as a list of options to assistive technology, and the editor announces which one is highlighted even though typing focus never leaves the editor.
- **The highlight never dangles** - it resets to the first entry whenever the filtered list changes, so it cannot point past the end of a shortened list.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
