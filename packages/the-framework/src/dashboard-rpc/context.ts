import { resolveAgentCheckout } from '../store/index.js'
import { defaultProjectsProvider, type ProjectsProvider } from '../dashboard/projects.js'
import type { DashboardContext, EventsSource, RemoteRuns } from '../dashboard/rpc-serve.js'
import type { PreferencesStore } from '../registry.js'
import type { DiscordCredentialsStore } from '../discord-credentials.js'
import type { QuotaSource } from '../dashboard/quota.js'
import type { AutoPmReporter } from '../auto-pm.js'

/**
 * What the dashboard's RPCs act through: the daemon's own closures, set once when it comes up.
 *
 * A module-level value, not a per-request one. It used to ride Telefunc's request context, read
 * back through `getContext()` inside an AsyncLocalStorage — machinery for a per-caller context
 * that never varied per caller. Two rounds of simplification got it here: three hosts wired
 * different subsets, so every accessor returned `T | undefined` and every RPC branched on the
 * absent case (D3 left one host, which wires all of it); and the request scoping itself was only
 * ever carrying process-wide wiring (F3). What is left is what it always was — the daemon's
 * capabilities, set at boot.
 */
let wired: DashboardContext | undefined

/** Wire the dashboard's capabilities. The daemon calls this once at start-up; a test calls it per case. */
export function setDashboardContext(context: DashboardContext): void {
  wired = context
}

/**
 * Read one capability.
 *
 * Unwired is a bug rather than a degraded host, so it throws and names the field instead of
 * silently answering as if nothing were configured.
 */
function fromContext<K extends keyof DashboardContext>(key: K): DashboardContext[K] {
  const value = wired?.[key]
  if (value === undefined) throw new Error(`the dashboard's RPC context has no ${String(key)}`)
  return value
}

/** No run is relayed from here — see {@link contextRemote}. */
const NO_RELAYED_RUNS: RemoteRuns = { target: () => undefined, list: () => [] }

/** The projects every telefunction resolves a project id against: the global registry. */
export function contextProjects(): ProjectsProvider {
  return defaultProjectsProvider()
}

/** The workspace path for a project id, or undefined when no project has that id. */
export function resolveProjectPath(projectId: string): Promise<string | undefined> {
  return contextProjects().resolvePath(projectId)
}

/**
 * The checkout a call should act on: a live run's own worktree when `agentId` names one (#738/#749),
 * else the project root. Since #736 a run reads and writes inside its worktree — its event log,
 * its control log, its working tree — so anything addressed at a *run* has to resolve here, not
 * at the project path, or it reads an empty log and steers a run that is not listening. The
 * resolution itself (and its #766 first-seconds subtlety) lives in the store's
 * {@link resolveAgentCheckout}, shared with the daemon; this adds only the project-id lookup.
 */
export async function resolveRunPath(projectId: string, agentId?: string): Promise<string | undefined> {
  const cwd = await resolveProjectPath(projectId)
  return cwd ? resolveAgentCheckout(cwd, agentId) : undefined
}

/**
 * The in-memory {@link EventsSource} (#426). It answers only for a run this daemon is relaying
 * from a connected device (#1067) — such a run has no `.the-framework/events.jsonl` here — and
 * returns undefined for an ordinary local run, whose log `onEvents` tails off disk.
 */
export function contextEventsSource(): EventsSource {
  return fromContext('eventsSource')
}

/**
 * The relayed-run lookup (#1067 slice 2). A run-scoped RPC uses it to tell an ordinary local run
 * (resolve a local checkout) from one running on a connected device (forward the call there).
 *
 * The one accessor with a default rather than a throw, because "unwired" has a real meaning here:
 * a call arriving over `/_relay/rpc` is the *device* side of the relay, and the run it names is
 * local to that device. Forwarding it onward would be a loop, so the honest answer there is that
 * nothing is relayed from here.
 */
export function contextRemote(): RemoteRuns {
  return wired?.remote ?? NO_RELAYED_RUNS
}

/** The user-preferences store (#410), over the registry file. */
export function contextPreferences(): PreferencesStore {
  return fromContext('preferences')
}

/**
 * The Discord credentials store (#1095): it writes the credential to the registry, then rebuilds
 * this daemon's own Discord services against it, so the bot connects without a restart.
 */
export function contextDiscord(): DiscordCredentialsStore {
  return fromContext('discord')
}

/** The quota source behind the usage panel (#533). */
export function contextQuota(): QuotaSource {
  return fromContext('quota')
}

/** Where auto PM's last decision is read from (#1161). */
export function contextAutoPm(): AutoPmReporter {
  return fromContext('autoPm')
}

/** How a sweep is fired on demand (#1210). */
export function contextAutoPmSweep(): (opts?: { drainOnly?: boolean }) => void | Promise<void> {
  return fromContext('autoPmSweep')
}

/** The daemon's own `startRun`, so a start from the dashboard is the same start the CLI makes. */
export function contextStartRun(): DashboardContext['startRun'] {
  return fromContext('startRun')
}

/** Install + register a repo (#433), which only the daemon can do. */
export function contextAddProject(): DashboardContext['addProject'] {
  return fromContext('addProject')
}
