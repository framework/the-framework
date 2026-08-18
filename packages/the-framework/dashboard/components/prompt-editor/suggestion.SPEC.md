Turns a trigger character typed in the composer into a floating menu at the caret: it filters as you keep typing, inserts the pick, and hides when nothing matches.

## TLDR

- Each trigger is built independently from its own character, item source, and insert action, so several menus coexist without clashing.
- The menu tracks the caret through scrolling and resizing, flipping above it near the bottom of the screen.
- A mistyped query hides the menu but keeps the trigger armed — a stray trigger character in prose is not a trap, and the menu reappears if a later keystroke matches.
- A fresh trigger over an empty source shows the trigger's explanatory note instead of nothing, so the feature never looks broken.
- While a menu shows, the editor announces it to assistive tech, and the rest of the composer can tell a menu is open — which is how Enter means "pick" instead of "send".

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
