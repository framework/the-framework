One menu picking the driver and its model together — drivers at the top level, each opening a submenu of only its own models, so a pick sets both at once and an incompatible pair can never be chosen; the trigger wears the current driver's logo and, when one is pinned, its model.

## Flows

- Every listed model is a real model id; there is no "Default" entry.
- Not choosing is still a state, and the trigger says so rather than naming the first model in the list.
- The trigger carries its own accessible name, because with no model pinned its rendered content is a logo and a chevron.

## Rationales

- A "Default" entry would store nothing, so the menu could not answer "which model is this"; naming the first model in the list instead would present an unset preference as whichever model happens to be listed first — a model the agent does not actually pass.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
