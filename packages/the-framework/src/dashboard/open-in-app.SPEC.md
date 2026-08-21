Opens a project in the OS file manager or the user's editor, and detects which known editors are installed so the picker can offer them.

## User Stories

- The user clicks "open folder" or "open in editor" on a project and it opens on their machine.
- The user's editor picker offers only editors that are actually installed.
- The user with a missing editor command gets a readable failure, never a crash.

## Flows

- Local machine only: the opened path is the project's own registered one, never something the browser sent, and a public host has no local checkout to open anyway.
- The stored editor preference wins, then the `$FRAMEWORK_EDITOR` environment override, then VS Code; a missing command comes back as a friendly failure, never a crash.
- Editor detection probes each known launcher on PATH — a pure lookup, nothing is spawned — which is how the picker knows what to offer.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
