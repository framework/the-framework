Serves the built dashboard app's files: the requested file when it exists, and otherwise the app shell, so client-side routes and unknown paths still boot the dashboard.

## Business logic — TL;DR

- **App-shell fallback** - any path that names no real file inside the bundle is answered with the app shell.
- **Never reads outside the bundle** - a path that escapes the bundle directory falls back to the shell instead of reading elsewhere on disk.
- **Nothing crashes the daemon** - an unparseable request target or a malformed escape in the path is treated as an unknown path, not an error.
- **Caching** - the app shell must always be revalidated; the fingerprinted assets are cached permanently.
- **A missing bundle says so** - when even the shell is absent, the response says the dashboard bundle is not built.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
