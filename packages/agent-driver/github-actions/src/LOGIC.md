A coding agent as a driver [1] of the `agent-driver` contract on a GitHub Actions runner, the reader of the run's artifact, and the package's entry point.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[2] correlation id: the id the `github-actions` driver makes up for one turn and hands the workflow, which echoes it into the run's display name and the artifact's name; it is the only way the driver finds its own run.

## Business logic — TL;DR

- **A coding agent on a GitHub Actions runner** (`actions.ts`, `actions.test.ts`) - each turn dispatches the agent workflow with the prompt as an input, finds its run by a correlation id [2], waits up to 1 hour, reads the transcript back from the run's artifact and replays it in a burst through `@agent-driver/claude`'s output reader; continuity across turns is one branch the driver names and every run pushes to. The runner holds no personal setup, so this driver takes none.
- **Reading a run's artifact** (`actions-zip.ts`, `actions-zip.test.ts`) - the zip archive GitHub hands back is read entry by entry and refused outright when it is not an archive, never read short.
- **The entry point** (`index.ts`) - the driver with its driver session, its transcript replay, its option types and its fetch seam; the zip reader stays internal.
