# Bug analysis: packages/framework/src/client.ts

## Business logic (high-level)

The dashboard's browser-safe entry: a pure re-export barrel with no logic of its own. Its single
invariant (per `client.SPEC.md`) is that nothing reachable from it may import a Node built-in, so
the browser bundle never drags in the server half. Everything behind it is the pure logic the
dashboard and daemon must agree on: event formatting, agent-view projections, system-prompt
composition, the preset catalog, `planTicketPrompt`, Auto PM routine lists, notification keys and
preference defaults, `agentOptionsFromPreferences`, the handoff ladder, Discord credential rules,
`isLoopbackHost`, `bridgeChoiceRequest`, and the cloud-run-state rule.

The invariant is enforced by `client.test.ts`, which walks the *compiled* import graph — the right
graph, since `import type` edges erase. I re-ran an equivalent walk over `dist/client.js`: 26
modules reachable, zero `node:` imports, and notably zero non-relative (bare package) imports
either — so even the walker's blind spot (bare specifiers are not followed, so a node-dependent
npm package could leak undetected) is vacuously safe today.

Failure modes considered: a re-exported name missing from its source module would be a TypeScript
compile error, not a runtime hazard; a future export that transitively reaches `node:*` is caught
by the test; a future export that pulls in a bare npm package with Node internals would not be —
noted as a latent limitation of the guard (recorded in `client.test.BUG-ANALYSIS.md`), not a
defect in this file.

## Functions (low-level)

No functions — only re-exports. Spot checks of the exported names against their sources:

- `DRIVERS`, `DRIVER_LABELS`, `isDriverName`, `driverFromImpl` — from `driver-names.js` (pure).
- `formatFrameworkEvent` (`terminal.js`), `formatBytes`, `errorMessage`, `pickedIds` — pure.
- `sessionInfo`/`agentProgress`/`agentErrors`/`handoffState` — `agent-view.js` projections, pure.
- `systemPromptBlock`/`composeAgentSystem`/`renderSystemPrompt`/`SYSTEM_PROMPT_TEMPLATE` — the
  string half of system-prompt; the disk half (`loadUserSystemPrompt`) deliberately lives in
  `system-prompt-file.ts` and is not exported here. Correct split.
- `defaultWhat`/`DEFAULT_WHAT`, `presets`/`LAUNCHER_PRESETS`, `planTicketPrompt` — pure.
- `AUTO_PM_ROUTINES`/`AUTO_PM_JOBS`/`AUTO_PM_DRAIN_JOB`/`AUTO_PM_MAINTENANCE_JOB` — pure lists.
- `interventionKey`/`activityKey`, `SeenTracker`, `ProjectionRead` (type) — pure.
- `NOTIFICATION_DEFAULTS`, `MAX_SPEND_OFFSET`, `DEFAULT_SPEND_OFFSET`,
  `DEFAULT_AUTO_PM_CONCURRENCY`, `notifies`, `notifyMethodEnabled`, `notifyCategoryEnabled` — pure.
- `agentOptionsFromPreferences`/`handoffFromPreferences`/`preferencesFromFileConfig` — pure.
- Handoff ladder exports — `handoff-level.js` is explicitly Node-free.
- Discord credential exports, `isLoopbackHost`, `bridgeChoiceRequest` — pure.
- `cloudRunState`/`cloudRunActive`/`CLOUD_SESSION_WINDOW_MS` — `cloud-run-state.js`, verified pure
  (its only import is a type import of `AgentMeta`).

Verdict: correct.

## Bugs found

None found.
