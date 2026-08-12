The runner — autopilot's pluggable execution seam: one contract for booting an isolated workspace (files, commands, optional live preview) where an agent builds and runs an app, with interchangeable environments behind it.

## TLDR

- Four implementations cover the sandboxing spectrum: an in-memory fake for tests, the local machine for already-trusted execution, a Docker container, and an in-browser WebContainer — a new sandbox drops in without the rest of autopilot changing.
- A booted workspace can be handed to an agent as tools, so the agent itself reads, writes, runs, serves, and previews inside its sandbox.
- Optional abilities (preview, background servers) are signaled by simply being absent; callers branch on presence, not capability flags.
- All implementations agree on the same behavior: workspace-relative paths with escapes rejected, timed-out commands killed and reported as such, and teardown that first stops whatever is still running.

## Rationales

- The contract is shaped after Flue's sandbox on purpose — the bet is to sit on existing harnesses rather than compete with them, so their sandboxes become just more runners.
- The fake shares the real escape guard, so tests exercised only against the fake cannot quietly pass on behavior production rejects.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
