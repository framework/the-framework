Type contracts for the runner seam — `Runner`, `RunnerSession`, `RunnerFs`, `RunnerProcess`, the boot/exec/preview option types, and `RunnerError`.

## TLDR

- Defines the pluggable execution seam, modeled on Flue's `sandbox` contract: `Runner.boot(BootOptions)` provisions an isolated workspace and returns a `RunnerSession` (id + `fs` + `exec` + optional `start`/`preview` + idempotent `dispose`).
- `FileTree` seeds a workspace (relative path → contents); `ExecResult` is `{ stdout, stderr, exitCode }` (0 = success); `ExecOptions` carries per-command `cwd`/`env`/`timeoutMs`.
- `RunnerProcess` is the handle for long-running commands started via `start` (dev servers): `exit` promise + idempotent `stop()`; unlike `exec`, `start` returns immediately.
- `PreviewOptions.waitMs` lets `preview()` block until the port accepts connections; default `0` (return immediately; runners that can't probe ignore it).
- `RunnerError` prefixes messages with `[ai-autopilot]`.

## Decisions

- Capability is signaled by *presence*: `session.preview` and `session.start` are optional members, absent when the runner doesn't support them — callers (and `runnerTools`) branch on `!== undefined` instead of a capability flags object.
- Shaped after Flue's sandbox so real sandboxes (WebContainer, Docker, Flue) drop in behind one interface — the "sit on harnesses, don't compete" bet made concrete.
