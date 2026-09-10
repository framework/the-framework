The layout gate: a tracked marker file, `.the-framework/LAYOUT`, records the names under which a build files The Framework's bookkeeping in a repository, and a build whose own layout differs from what the repository records refuses to run there, with both layouts named and the fix for each direction, instead of committing files under names the repository does not use. Activation (`install.ts`) writes the marker, and the agent's [1] process checks it before it does anything else in a checkout [2].

## Context

**Problem**: a repository can be worked by several builds of The Framework at once: the one installed on this machine and, for a `web` agent [1], the one the cloud session [3] installs from npm. A published build that predates a rename of a bookkeeping name would half-work: its agent runs, but files its records under the old name, and the repository's own guard rejects that commit hours later. A skewed build is therefore refused outright, with no degraded mode, the same way a skewed Chrome extension is.

## Glossary

[1] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[3] cloud session: A Claude Code cloud session on claude.ai, the far end of a `web` agent.
[4] the `agent-data` branch: The branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[5] event stream: Everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout.
[6] run: Only the `logs` skill's record of one agent on the `agent-data` branch.

## Business logic — TL;DR

- **What the marker records** - one `name: value` line per bookkeeping name the build uses, pure data with no comment: the framework directory (`.the-framework`), the `agent-data` branch [4] (`agent-data`), the event stream [5] file (`events.jsonl`), the agent's status file (`agent.json`), the tickets directory (`tickets`), the agent queue file (`TODO_AGENTS.md`) and the runs [6] directory (`agents`).
- **Derived, never bumped by hand** - the marker's content is derived from the build's own layout constants, so renaming one changes the marker by itself, and the repository's checked-in marker is pinned to the derivation by a test that fails a rename until the file is regenerated.
- **Tracked, so every clone carries it** - the ignore file written at activation un-ignores `LAYOUT`, so every checkout and every clone, a cloud session's included, carries the repository's recorded layout.
- **What a mismatch means** - a repository with no marker is ungated and passes; a marker equal to this build's passes; a different one refuses, and the agent's process stops before doing anything, with a message that names `.the-framework/LAYOUT`, prints what this build writes and what the repository records, and says what to do in each direction: update The Framework to a build matching the repository when the build is the older side, or rewrite the marker with the build's layout and land it as the rename's own commit when the build is the newer side.
