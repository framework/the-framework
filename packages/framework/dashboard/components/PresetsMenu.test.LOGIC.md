What the tests cover:

- **Built-ins load their rendered prompt** - the menu lists the built-in presets by label, and clicking one hands over the prompt the preset renders, its label, and its "agent of its own" rule when it has one.
- **Custom presets load verbatim** - clicking one of the user's presets or one of the project's shared presets hands over the saved prompt text exactly, with its label.
- **Deleting without loading** - the X on a preset row deletes that preset by id and does not load it; a project preset is deleted through the project path, never through the user's.
- **Empty groups are hidden** - the "Project presets" group is absent when the project has none.
- **"New preset…"** - clicking it opens the create panel; the item is absent where no panel exists.
