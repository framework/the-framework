How many errors an agent reported, shown wherever the agent's header stays put while its log scrolls — the agent's action bar and the project's agent overview. Nothing is shown when the agent reported none.

## Business logic — TL;DR

- **A count, not the errors** - the errors themselves stay in the log at the point of the agent's work where they happened; this only says how many there are.
- **What, without opening anything** - hovering lists every error's headline; where the row has the room, the latest headline is shown inline beside the count.
- **Never truncated** - the count keeps its full width even in a crowded row, since a clipped count is worse than none.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
