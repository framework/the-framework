Shared workspace path rules: `norm()` normalization plus the `safeSegments()` escape guard used by the fake, Docker, and WebContainer runners.

## TLDR

- `norm(path)`: drops a leading `./` or `/` (paths are always workspace-relative, never host-absolute) and trailing slashes; does NOT resolve `..` — that is the guard's job.
- `safeSegments(path)`: splits into segments; empty and `.` segments are dropped; `..` pops the previous segment and throws `RunnerError('path escapes the workspace: <original path>')` once there is nothing left to pop; an empty result means the workspace root.

## Decisions

- Extracted into one module because every runner carried a copy whose agreement was maintained only by prose comments ("matches LocalFs/FakeFs"); drift in the fake would mean tests passing against behavior production doesn't have.
- `LocalRunner` deliberately does NOT use `safeSegments`: it has a real root, so it resolves against it and asks `node:path` whether the result stayed inside, which also catches what the host resolves differently (symlinks, `..` through a link). Two implementations on purpose, not a leftover copy.

## Facts

- A host-absolute path (`/abs.txt`) is treated as workspace-relative, not as an escape.
- The escape error names the offending path unnormalized, so the message says what was actually asked for.
