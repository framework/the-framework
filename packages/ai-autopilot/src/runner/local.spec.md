`LocalRunner` — the first real adapter behind the runner seam: each workspace is a real temp directory on the host with real child processes and a localhost preview; the reference the sandboxed runners mirror. Unsandboxed by design — only for already-trusted execution (local dev, or a CI job that is itself the sandbox).

## TLDR

- `boot()` creates `mkdtemp(<root>/ai-autopilot-)` (root defaults to the OS tmpdir) and seeds `files`; `adopt(dir)` wraps an *existing* directory instead, and its `dispose` does NOT delete it (`keep` flag).
- `LocalFs` uses real `node:fs` guarded by `within()` — resolve against the root, then `node:path.relative` containment check (not `safeSegments`; catches symlinks and host-resolved `..`). `list` walks recursively and returns sorted `/`-joined relative paths; a missing dir yields `[]`, mirroring the fake's prefix filter.
- `exec()` spawns `{ shell: true, detached: true }`, merges `process.env` + session env + per-call env; timeout SIGKILLs the whole process group and returns exit `124` with a `command timed out` stderr note.
- `start()` returns a `RunnerProcess` immediately (own process group); `stop()` escalates group SIGTERM → 2s race → SIGKILL, then awaits exit.
- `preview()` returns `previewHost:port` (defaults `http://localhost`, port 3000); with `waitMs` it polls TCP connect on `127.0.0.1` every 100ms until reachable or deadline.
- `dispose()` stops leftover background procs, then `rm -rf` the workspace (skipped for adopted dirs); idempotent, and disposed sessions reject exec/start/preview.

## Problems

- Timing out a shell command reliably: a plain kill only reaps the `sh` wrapper; a surviving grandchild keeps the inherited stdio open so `close` never fires and the timeout never lands. Fixed by spawning in its own process group (negative-pid kill takes the whole tree) plus a 250ms "reaper" timer that settles the promise even if a detached grandchild still holds the pipes.
- Exit code fallback when killed by signal: `code ?? (signal ? 137 : …)`.

## Decisions

- `adopt()` exists to run/verify code that already lives on disk (e.g. an app a wrapped coding agent just wrote); the directory belongs to the caller so dispose must not remove it.

## Flows

- exec: `spawn(sh -c, detached group)` → collect stdout/stderr → on timeout: kill group SIGKILL + reaper(250ms) → exit 124; else on close → exit code.
- boot-and-serve: `start(cmd)` (returns at once) → `preview({ port, waitMs })` waits for TCP → caller fetches URL → `proc.stop()` (SIGTERM→SIGKILL group) → `dispose()` stops leftovers + removes workspace.
