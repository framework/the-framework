Reads a host workspace into a Runner `FileTree` so a fresh Docker sandbox container can be seeded with the source the driver wrote — the Docker analog of `LocalRunner.adopt` (which adopts the host dir in place).

## TLDR

- `snapshotWorkspace(dir)`: recursive walk → `{relative path → contents}`, POSIX separators always (the key is a path inside a Linux container).
- Text only and deliberately shallow on cost: `SANDBOX_IGNORE` dirs skipped (node_modules/.git/dist/build/.next/… and `.the-framework`), files over 1 MiB skipped (size checked *before* reading, so a huge asset is never loaded), NUL-byte files treated as binary and skipped, symlinks/sockets/devices skipped.
- `node_modules` is copied by nobody: the sandbox rebuilds deps from the seeded `package.json`.
- A first-slice serve-verification seed, not a faithful mirror — a skipped binary's absence does not stop the app from booting for a health check.
