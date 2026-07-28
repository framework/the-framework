Renders the surfaced PLAN/TODO documents the agent writes (#319/#328) as tab buttons over a Markdown view; the read lives in the rail (#1146), this renders what it is handed.

## Facts

- Loading and empty are different facts (#948): without the `loaded` guard, a project with docs flashed "No PLAN/TODO docs yet." on every open while the first read was still out.
- The active index is clamped to `docs.length - 1`, so a shrinking doc list cannot leave a dangling selection.
