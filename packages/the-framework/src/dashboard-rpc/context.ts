import { getContext } from 'telefunc'
import { resolveRunCheckout } from '../store/index.js'
import { defaultProjectsProvider, type ProjectsProvider } from '../dashboard/projects.js'
import type { DashboardContext, EventsSource, RemoteRuns } from '../dashboard/telefunc-serve.js'
import type { PreferencesStore } from '../registry.js'
import type { DiscordCredentialsStore } from '../discord-credentials.js'
import type { QuotaSource } from '../dashboard/quota.js'
import type { AutoPmReporter } from '../auto-pm.js'

/**
 * Read one field off the Telefunc request context.
 *
 * This used to be a capability probe: three hosts served this surface — the daemon, a per-session
 * foreground dashboard, and a public relay — each wiring a different subset, so every accessor
 * returned `T | undefined` and every RPC carried a branch for the absent case. One host wires all
 * of it now (D3), so a field is simply there.
 *
 * A call made outside a request has no context at all, which is a wiring bug rather than a
 * degraded host: it throws, naming the field, instead of silently answering as if nothing were
 * configured.
 */
function fromContext<K extends keyof DashboardContext>(key: K): DashboardContext[K] {
  const value = optionalFromContext(key)
  if (value === undefined) throw new Error(`the dashboard's Telefunc context has no ${String(key)}`)
  return value
}

/** {@link fromContext} for the one field that has a meaning when there is no request at all. */
function optionalFromContext<K extends keyof DashboardContext>(key: K): DashboardContext[K] | undefined {
  try {
    return getContext<DashboardContext>()[key]
  } catch {
    return undefined
  }
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
 * The checkout a call should act on: a live run's own worktree when `runId` names one (#738/#749),
 * else the project root. Since #736 a run reads and writes inside its worktree — its event log,
 * its control log, its working tree — so anything addressed at a *run* has to resolve here, not
 * at the project path, or it reads an empty log and steers a run that is not listening. The
 * resolution itself (and its #766 first-seconds subtlety) lives in the store's
 * {@link resolveRunCheckout}, shared with the daemon; this adds only the project-id lookup.
 */
export async function resolveRunPath(projectId: string, runId?: string): Promise<string | undefined> {
  const cwd = await resolveProjectPath(projectId)
  return cwd ? resolveRunCheckout(cwd, runId) : undefined
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
 * The one accessor with a default rather than a throw, because "no request at all" has a real
 * meaning here: a call arriving over `/_relay/rpc` is the *device* side of the relay, dispatched
 * outside Telefunc, and the run it names is local to that device. Forwarding it onward would be
 * a loop, so the honest answer there is that nothing is relayed from here.
 */
export function contextRemote(): RemoteRuns {
  return optionalFromContext('remote') ?? NO_RELAYED_RUNS
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
