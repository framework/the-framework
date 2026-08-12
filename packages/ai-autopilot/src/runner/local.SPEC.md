The runner that uses the machine itself: each workspace is a real temp folder with real commands and a localhost preview — the reference implementation, meant only for already-trusted execution since nothing sandboxes it.

## TLDR

- Boot creates a fresh temp folder; dispose stops anything still running and deletes it.
- A dev server can be started in the background and later stopped along with everything it spawned; command timeouts likewise kill the whole process tree, not just the shell.
- The preview can wait until the server actually accepts connections, so the URL is live the moment it is handed over.
- An existing folder can be adopted as the workspace — e.g. an app some other tool just wrote — and disposal then leaves the caller's folder untouched.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
