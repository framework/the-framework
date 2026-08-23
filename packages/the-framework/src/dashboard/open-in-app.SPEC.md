The project panel's "Open in Finder / editor" action: the daemon launches a local command that reveals a project's repo in the OS file manager or opens it in a code editor. Localhost-only by nature — the path opened is always the project's own registered path (never client input), and a daemon serving a public host has no local checkout to open.

## Business logic — TL;DR

- **The OS reveal command** - macOS `open`, Windows `explorer`, anything else `xdg-open`.
- **Which editor opens** - the user's stored editor preference; when unset, the `FRAMEWORK_EDITOR` environment variable; when that is unset too, the VS Code launcher `code`. A hand-typed editor outside the known catalog stays valid.
- **Editor auto-detection** - a fixed catalog of known editors (VS Code, VS Code Insiders, Cursor, Windsurf, Zed, Sublime Text, WebStorm, IntelliJ IDEA, Neovim, Vim, Emacs) is probed by looking each launcher up on PATH — a pure lookup, nothing is spawned — and the dashboard's editor picker offers the installed subset in catalog order.
- **Launch, don't wait** - the command is spawned detached, and success means it launched, not that it exited: a long-lived editor never blocks the daemon, and Windows' `explorer` exiting non-zero on success does not read as failure.
- **Failures are values** - an open attempt never throws; a command missing from PATH reports a friendly `"<command>" was not found on PATH`, and anything else reports the underlying error's own message.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
