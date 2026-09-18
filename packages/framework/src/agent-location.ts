/**
 * Where a run's turns executed, as a run's record names it (D1): this machine, a GitHub Actions
 * runner, or a Claude Code cloud session. A run started today is local; the other two are read
 * off records of runs from before the launcher started runs through the project's hook (#1774),
 * and off the cloud work the bridge still adopts.
 *
 * Node-free on purpose, like `driver-names.ts`: the dashboard and the store both name this axis.
 */

/** Where an agent executes. */
export type AgentLocation = 'local' | 'actions' | 'web'
