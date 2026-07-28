`useStartRun()` — the start-run mutation over `sendStart`, built on `useAction`, shared by both composers that start runs (the launcher and the finished-run continuation).

## TLDR

- `start(projectId, text, kind, options, fallback?)` resolves with the success branch (`{runId?}`) or `undefined` with the error state set.
- Starting is the one mutation with a failure branch of its own: the daemon refuses a second run on the same checkout with `busy`; that refusal is rephrased for the dashboard ("A session is already active for this project.") since the daemon's wording targets its own log.
- Sharing the hook means the refusal reads the same on either surface and neither hand-rolls the busy/error scaffold.
