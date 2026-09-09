What the tests cover: a run's card and diary as pure text and values.

- **Ids and file names** - letters, digits, dashes and underscores make an id; a dot, a slash, a space or nothing does not; a card file is named after one, a diary or any other file is not a card.
- **A person's directory** - an email trimmed, lowercased and made safe; a value that could climb out of a directory never starts with a dot or holds a separator; no identity, a blank one or an absurd length files as `anonymous`.
- **A card** - reads back with the package's fields and the writer's under `caller`, unknown top-level fields dropped, and a field of the wrong shape dropped; not JSON, not an object, no status, an unknown status or an id that is not one is no card; the command's view of a card has no `caller`; a card is written with the package's fields first and `caller` last, absent fields left out, and reads back the same.
- **A diary** - JSON lines each with a kind, a line without one or a bare value skipped; the agent's lines are the four kinds with their fields, extra fields carried along, and a known kind missing its fields is not the agent's; a torn line ends the read and keeps what came before; a diary formats back to one object per line.
- **Matching and ordering** - a run worked a ticket by its exact path or its file name, not by a shorter suffix, and a run with no ticket worked none; newest first is the id order reversed.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
