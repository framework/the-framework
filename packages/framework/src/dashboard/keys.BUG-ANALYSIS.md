# Bug analysis: packages/framework/src/dashboard/keys.ts

## Business logic (high-level)

The single definition of "what makes two watched items the same item" for both notification feeds — the identity the daemon's `SeenTracker` dedupes on, re-exported to the browser through `client.ts` so daemon and dashboard cannot drift (the SPEC's stated reason this is one module). Deliberately a leaf: type-only imports from `activity.ts`/`interventions.ts` are erased, so the browser bundle can reach it.

Invariants:
- a `pr` intervention is its URL (survives title edits/re-sorts; and a URL is globally unique per PR, so two projects pointing at the same GitHub repo produce the *same* key for the same PR — the correct collapse);
- `awaiting` is `awaiting:<projectId>:<awaitId>` and `unpushed` is `unpushed:<projectId>:<agentId>` — both would otherwise collide on the shared dashboard URL;
- an activity item is `<kind>:<projectId>:<agentId>` so one agent's `started` and `finished` are two announcements, each once.

Cross-file consequence noticed here (fix belongs elsewhere): because `activityKey` includes `projectId`, the same run surfacing under two registered checkouts of one repository (they share the tf-data archive — the exact situation #1648 dedupes in `buildRecentAgents` and `buildOverview`) yields two *distinct* keys, so `buildActivity`'s feed double-notifies every start and every finish, permanently. The key is right (per-project separation is wanted for genuinely different projects); the missing dedupe-by-run-id is in `buildActivity` (activity.ts L81-86), which pushes each project's agents with no cross-project `seen` set. Recorded in the report against activity.ts.

## Functions (low-level)

- **`interventionKey(item)`** — branch on `kind`. Edge cases: `awaitId`/`agentId` are optional on the type and defaulted to `''` — two awaiting items in one project both missing `awaitId` would collide and the second never notify; `buildInterventions` always sets them for their kinds, so this is a reliance on the builder, noted, not a bug. The fallback branch returns `item.url` for `kind === 'pr'` (the only remaining kind; `url` is required on the type). Verdict: correct.
- **`activityKey(item)`** — template of three required fields; no separator-injection concern since projectId is URL-safe and agentId is the store's safe id. Verdict: correct (but see the cross-file consequence above).

## Bugs found

None found in this file. Cross-file: 1. (fix in `packages/framework/src/dashboard/activity.ts` L81-86) `buildActivity` lists a shared-archive run once per registered checkout, and with `activityKey` embedding `projectId` the notification watcher announces each start/finish twice for users with two checkouts of one repository registered. Severity: minor. Fix sketch: dedupe agents by `agent.id` across projects inside `buildActivity` (first project keeps the row), mirroring `buildRecentAgents` (#1648).
