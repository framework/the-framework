Opens a project in the OS file manager or the user's editor, and detects which known editors are installed so the picker can offer them.

## TLDR

- Local machine only: the opened path is the project's own registered one, never something the browser sent, and a public host has no local checkout to open anyway.
- The stored editor preference wins, then an environment override, then VS Code; a missing command comes back as a friendly failure, never a crash.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
