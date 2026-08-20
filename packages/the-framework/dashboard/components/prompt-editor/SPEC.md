The machinery behind the composer's in-editor triggers and token chips: typing a trigger character opens a menu at the caret, and picked or typed tokens become pills that always submit as the exact plain text the agent parses.

## Flows

- The composer wires four triggers with it: `/` for commands and presets, `<` for the agent's tags, `@` for project references, `#` for file references.
- A trigger menu filters as you type, picks with Enter/Tab or a click, and closes on a non-match, so stray trigger characters in prose are never a trap.
- Macros, action calls, and references render as chips edited as one unit; a fully hand-typed token becomes a chip too, its casing normalized.
- Loading a preset chip-ifies the plain token strings it contains.
- The menus work with assistive tech, and while one is open Enter picks from it instead of sending the prompt.

## Rationales

- The one invariant: chips change how the prompt looks, never what it says — the submitted text stays exactly what the agent already parses, so presets and everything downstream are untouched.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
