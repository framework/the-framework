One menu picking the driver and its model together — drivers at the top level, each opening a submenu of only its own models, so a pick sets both at once and an incompatible pair can never be chosen; the trigger wears the current driver's logo and, when one is pinned, its model.

## TLDR

- Every listed model is a real model id. There is no "Default" entry: picking it stored nothing, so the menu's own answer to "which model is this" was "we do not know".
- Not choosing is still a state, and the trigger says so rather than naming the first model in the list — which is what it did while that entry existed, so an unset preference read as whichever model happened to be listed first.
- The trigger carries its own accessible name, because with no model pinned its rendered content is a logo and a chevron. It used to be named by the model text incidentally, and that text was "Default".

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
