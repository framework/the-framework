What the tests cover: revealing a folder uses each operating system's own file manager (macOS, Windows, Linux); opening a folder in an editor defaults to VS Code and otherwise honors the editor the user configured, either through the environment or through the preference passed from the dashboard; a successful open reports success and targets the requested folder; an open that fails because the editor is not installed reports a readable "not found" message instead of a raw failure; editor detection returns only the editors actually probed as installed, in the catalog's own order, and an empty list when none are installed.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
