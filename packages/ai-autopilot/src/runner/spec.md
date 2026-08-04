The runner seam: a pluggable workspace (filesystem + shell + optional background processes and preview) where autopilot builds and runs an app.

## TLDR

- Contract: a runner boots a session exposing `fs`, `exec`, optional `start`/`preview`, and `dispose`. **Capability is signalled by property presence, not flags** — the serve check and the agent tools both branch on it.
- Implementations: `FakeRunner` (in-memory, records calls), `LocalRunner` (real host temp dir; `adopt()` reuses an existing directory without deleting it on dispose), `DockerRunner` (via the `docker` CLI — no npm dependency), `WebContainerRunner` (browser-only, optional peer dependency, one live instance per page). `runnerTools` exposes a booted session to an ai-sdk agent, capability-gated, with read-only variants.
- Shared conventions: timeouts report exit code 124 with an appended stderr note; signal-killed processes report 137; a disposed session throws on every operation.

## Decisions

- Path safety has **two implementations on purpose**: a shared segment-based guard used by the sandboxed runners (and by the fake, precisely so the test double cannot drift from production behavior), while the local runner resolves against its real root and asks the OS — catching symlinks and host-specific resolution the segment rules cannot.
- Local processes spawn detached so a timeout or stop kills the whole process group — a plain kill only reaps the shell wrapper, and a surviving grandchild holds stdio open so the close never fires.
- Docker readiness is probed **inside** the container, because Docker Desktop's host-side port proxy pre-binds published ports and lies; the preview port is fixed at boot (Docker maps at start) and a mismatched preview request is a hard error; file writes pass the path as an argv value so it can never be reinterpreted as shell.
- WebContainer output is a pty that merges streams, so stderr is always empty there — a documented deviation.

## Facts

- The local runner is unsandboxed on the host — documented as for local dev or a CI job that is itself the sandbox, never untrusted agent-authored code.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
