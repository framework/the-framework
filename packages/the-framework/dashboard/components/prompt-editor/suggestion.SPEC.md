How one typed trigger in the prompt editor behaves: when its menu opens, where it sits, how it closes, and what picking an entry does.

## Business logic — TL;DR

- **The menu follows the caret** - it opens just under the character the user is typing and keeps tracking it while the page or the editor scrolls or the window is resized; near the bottom of the window it flips above the caret instead of running off the screen.
- **Typing filters, mistyping closes** - each keystroke re-filters the menu against what has been typed after the trigger character. A query matching nothing hides the menu, so a stray `<`, `@`, `#` or `/` in ordinary prose is never a trap — yet the trigger stays armed, and the menu comes back if a later keystroke matches again.
- **An empty source explains itself** - when the trigger opens with nothing to offer and nothing typed yet, its own note is shown rather than nothing at all, which would look like a broken feature.
- **Escape closes** - Escape is left to the editor, which dismisses the menu; the arrow keys, Enter and Tab are handled by the menu.
- **Each trigger is independent** - the `/`, `<`, `@` and `#` menus never clash with one another.
- **Open-ness is announced** - while a menu is visible the editor reports that a menu is open and which entry is highlighted. That same visible state is what tells the editor to let Enter pick an entry instead of sending the prompt, so the two can never disagree.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
