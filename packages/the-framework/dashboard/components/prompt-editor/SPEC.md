The supporting pieces of the dashboard's rich prompt editor: the typed triggers that open a menu, the menu itself, and the chips the menus insert.

## Glossary

- **chip** - an inserted reference or tag shown as one inline pill in the prompt editor, selected and deleted as a single unit rather than character by character.
- **macro tag** - one of the framework's repeated prompt tags, all written `<NAME>` (for example `<AWAIT>`).
- **agent action** - a call the prompt can ask the agent to make (for example `showMultiSelect()`).

## Business logic — TL;DR

- **Typing a character opens a menu** - `/` offers presets and agent actions, `<` the macro tags, `@` the registered projects, `#` the open project's files. The menu opens at the caret, follows it, filters as the user types, and closes when nothing matches, so a stray trigger character in prose costs the user nothing.
- **One menu, one way to use it** - every trigger shows the same floating list: arrows move, Enter or Tab picks, the mouse works too, entries carry a hint and can be grouped, and a trigger with nothing to offer says so instead of appearing broken.
- **Picking inserts a chip** - the chip reads as a pill but stands for exact plain text, so the prompt the agent receives is the same as if the user had typed it out.
- **Typed and loaded text becomes chips too** - a token finished by hand turns into a chip on the spot, and loading a preset converts the tokens in its text as well, so a loaded preset looks just like an assembled one. Catalogued tokens are normalized to their canonical spelling on the way in.

## Business logic

### The chip guarantee

#### User story

The user assembles a prompt from menus and expects the agent to behave exactly as if the prompt had been typed as plain text.

#### Business logic

A chip carries both how it reads and how it writes. On send, only what it writes goes into the prompt, verbatim and unescaped. This is what allows the editor to be a friendlier surface without changing the prompt contract the agent already works to.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
