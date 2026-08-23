The picker for which driver an agent uses and which of that driver's models it runs — one menu, so an impossible pairing cannot be chosen.

## Business logic — TL;DR

- **Driver first, then its own models** - the menu's top level is the drivers; each driver opens a submenu holding only the models that driver offers. Picking a model sets the driver and the model together, so a combination like Codex plus a Claude model is unreachable.
- **The current pick is marked in both levels** - a tick sits on the current driver and on the current model within it.
- **Nothing is invented when no model is pinned** - a model pinned on the other driver, or never pinned at all, leaves the trigger naming no model rather than borrowing the first entry in the list; naming a model the agent will not actually be passed would be worse than saying nothing.
- **The trigger stays readable without text** - it shows the driver's logo and the model name, and always spells the full state out for assistive technology and in its tooltip: the driver's name, and the model's name or "the CLI's own default" when none is pinned.
- **Frozen while busy** - the picker stops accepting changes while the surface it sits on is working.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
