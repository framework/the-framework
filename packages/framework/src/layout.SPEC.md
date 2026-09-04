The layout gate: a build of The Framework refuses to run in a project whose recorded bookkeeping layout differs from its own.

## Business logic — TL;DR

- **The project records the layout it uses** - the layout marker is a tracked file under `.the-framework/`, so every clone and every worktree of the project carries it. It records every name a committed artifact's path hangs off: the framework directory, the `agent-data` branch, the logs branch, the archive directory, the event log and agent meta file names, the tickets directory, and the agent queue file.
- **A mismatch is refused outright** - a build whose layout differs from the project's records refuses to run there, and says both layouts in full plus the fix for each direction: update The Framework to a build that matches the project, or, when the build is the newer side, rewrite the marker as part of the rename itself.
- **An unmarked project is ungated** - a project with no marker runs without the check. Activation writes the marker, so every newly activated project is gated from the start.
- **Refusal is a reported outcome** - the check reports its verdict for the caller to act on rather than crashing.

## Business logic

### A skewed build is refused, never run in a degraded mode

#### User story

A user runs an agent in a project whose bookkeeping The Framework has since renamed — or, the other way round, runs a published build that predates a rename the project already has.

#### Business logic

Neither side is allowed to half-work. The build compares its own layout against the project's marker before doing anything, and where they differ it stops and names both.

#### Rationale

The failure this prevents happened for real: a cloud environment installed The Framework from the registry, the published build predated a rename of the directory holding agent archives, and the agent's bookkeeping landed under the old name — a commit in the wrong layout that was only rejected hours later, when it could have been refused before the agent started.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
