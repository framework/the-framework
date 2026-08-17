/**
 * The driver vocabulary (#542), node-free so every surface shares one copy: the session spec,
 * the registry's preference sanitizer, and the dashboard bundle — which must not import the
 * driver layer (it spawns processes), and whose "kept local" copies existed only because this
 * list used to live beside those imports. Adding a driver is one entry here plus its
 * implementation; the dashboard's per-driver UI table is keyed by {@link DriverName}, so a
 * missing entry there is a compile error, not a silent gap.
 *
 * These are the *choice* — which coding-agent CLI does the work — not the implementation that
 * carries it out. One driver has several implementations because it can run in several places:
 * `claude` is `claude-code` locally, `claude-web` in a cloud session, and `github-actions` on a
 * runner. That is what {@link DriverImplId} names and {@link driverFromImpl} collapses.
 *
 * Both were called "agent" until D5, when the unit of work took that word. The two meanings sat
 * one line apart in the CLI's own help — "which coding-agent CLI drives the session" — and the seam
 * between them is exactly where a reader had to guess which was meant.
 */

/** The coding-agent CLIs the framework can drive, in the order surfaces list them. */
export const DRIVERS = ['claude', 'codex'] as const

/** A driver the user can pick. */
export type DriverName = (typeof DRIVERS)[number]

/** Whether `value` names a driver we can run. */
export function isDriverName(value: string | undefined): value is DriverName {
  return value !== undefined && (DRIVERS as readonly string[]).includes(value)
}

/** How each driver reads in a sentence or on a button. */
export const DRIVER_LABELS: Record<DriverName, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
}

/**
 * The stable id of one concrete implementation, as recorded on a session's meta. A driver has
 * one per place it can run, which is why this is a wider set than {@link DriverName}.
 */
export type DriverImplId = 'claude-code' | 'claude-web' | 'github-actions' | 'codex' | 'fake'

/**
 * The driver behind an implementation id (#831): a session records the implementation that ran it
 * (`claude-code`), while the choice is the driver name (`claude`). `undefined` for an
 * implementation no driver claims (the fake one, or a record from a newer version). An
 * implementation whose id differs from its driver's name needs a case here, like claude's does.
 */
export function driverFromImpl(impl: string | undefined): DriverName | undefined {
  // Every surface Claude runs on is still Claude (#1263): the local CLI, the cloud session, and
  // the Actions runner. Where it runs is the session's `target`, not its driver.
  if (impl === 'claude-code' || impl === 'claude-web' || impl === 'github-actions') return 'claude'
  return isDriverName(impl) ? impl : undefined
}
