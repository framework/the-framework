What the tests cover: asking the OS for a folder without ever opening a real dialog.

- A picked folder comes back as its absolute path with the OS's trailing slash dropped, and the dialog asked for is the OS's own (macOS's standard folder sheet).
- Dismissing the dialog is a normal "nothing picked" answer, not an error.
- A dialog that failed to open surfaces its reason.
- A platform with no wired picker answers so directly, without attempting to open anything.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
