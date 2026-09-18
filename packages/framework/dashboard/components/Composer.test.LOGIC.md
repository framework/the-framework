What the tests cover:

- **The control row** - the full composer shows the "Commands" button, the coding-agent-and-model select, whose name reads "Driver: Claude Code" by default, and the "Run on" pick; the submit button exists only once the box has text. The compact single row keeps the select and "Run on" and still submits. A surface that asks for no select gets the rest of the row without it.
- **Submitting** - "Send" is absent while the box is empty, then enabled with text and hands over the text; the editor's own submit shortcut does the same; every change to the text is mirrored out.
- **A command from the menu** - picking a command [1] in the Commands menu loads its slash line into the editor, and what is then submitted is that line plus the argument typed after it.
- **A surface that cannot submit** - when the embedding surface says nothing can be submitted, the button stays disabled with text in the box, and neither the click nor the editor shortcut submits.
- **A carried draft** - a draft carried from another device [2] is seeded into the launcher's box, visible in the editor itself and not only in what a start would send, and taken from its holding place once; a composer inside an agent [3] leaves the carried draft untouched.
- **An offline "Run on" device** - with the selected device reported offline, the note "Studio is offline" appears, "Send" is disabled, and neither the button nor the editor shortcut submits; with the device reported online there is no note, the button is enabled, and the submit goes out.
- **Inside an agent** - there is no "Run on" pick: an agent already runs where it was started.

## Glossary

[1] command: one of the project's skills, typed as `/<name>`, optionally followed by an argument.
[2] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[3] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook.
