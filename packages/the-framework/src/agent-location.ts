/**
 * Where a run's turns actually execute — the axis the `Driver` seam used to swallow (D1).
 *
 * There were five "drivers": `claude-code`, `codex`, `cloud`, `actions`, `fake`. Two of those are
 * the same agent in a different place — Claude Code on claude.ai, and Claude Code in a GitHub
 * Actions runner — so the seam modelled *which agent* and *where it runs* as one dimension.
 *
 * The cost was visible in `handsOff`: a **driver property that disabled half a run's phases**,
 * because a property of *where* had leaked into the abstraction for *what*. It lives here now, as
 * a fact about the location, and `Driver` is back to "which CLI do I spawn".
 *
 * Node-free on purpose, like `agent-names.ts`: the dashboard, the registry and the store all name
 * this axis, and none of them should have to reach the driver layer to do it.
 */

/** Where a run executes. */
export type AgentLocation = 'local' | 'actions' | 'web'

/** Every location, for validating what arrives from a browser or a config file. */
export const RUN_LOCATIONS = ['local', 'actions', 'web'] as const

/** Whether `value` names a location. */
export function isRunLocation(value: unknown): value is AgentLocation {
  return typeof value === 'string' && (RUN_LOCATIONS as readonly string[]).includes(value)
}

/**
 * Whether this location hands the task somewhere this machine cannot follow (#1225), making the
 * first prompt the whole run.
 *
 * Everything a run would do after that prompt — work the backlog, stay open for messages — would
 * be reading the driver's own "handed off to <url>" summary as if the agent had written it. That
 * is what put an unanswerable "Start the next backlog item?" on a dashboard whose agent was
 * somewhere else entirely.
 *
 * True for `web` alone: a cloud session opens its own pull request and never reports back here.
 * An Actions runner streams its agent's own replies, so it is followed like a local run.
 */
export function isHandsOff(location: AgentLocation | undefined): boolean {
  return location === 'web'
}
