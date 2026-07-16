import { getContext } from 'telefunc'
import { defaultProjectsProvider, type ProjectsProvider } from '../dashboard/projects.js'
import type { DashboardContext, EventsSource } from '../dashboard/telefunc-serve.js'
import type { PreferencesStore } from '../registry.js'
import type { QuotaSource } from '../dashboard/quota.js'

/**
 * Read one field off the Telefunc request context, or undefined when it is unset. Every
 * real call runs inside `serve({ context })`; the try/catch is the defensive fallback for
 * a call made outside a request. The named accessors below add each field's meaning; this
 * is the shared plumbing they all sit on.
 */
function fromContext<T>(pick: (ctx: DashboardContext) => T | undefined): T | undefined {
  try {
    return pick(getContext<DashboardContext>())
  } catch {
    return undefined
  }
}

/**
 * The {@link ProjectsProvider} a telefunction should read a project id against (#427).
 * The mount puts one on the Telefunc request context: the daemon leaves it unset, so
 * every RPC resolves against the global registry; the per-run foreground dashboard
 * passes a single-project provider scoped to its `cwd`. Falls back to the registry when
 * no context is set (defensive — every real call runs inside `serve({ context })`).
 */
export function contextProjects(): ProjectsProvider {
  return fromContext(ctx => ctx.projects) ?? defaultProjectsProvider()
}

/** The workspace path for a project id (registry, or single-project #427), else undefined. */
export function resolveProjectPath(projectId: string): Promise<string | undefined> {
  return contextProjects().resolvePath(projectId)
}

/**
 * The in-memory {@link EventsSource} on the context, or undefined (#426). Only the relay
 * sets one — it has no `.the-framework/events.jsonl` on disk, so `onEvents` streams from
 * the relay's in-memory run instead. Unset on the daemon/foreground, where `onEvents`
 * tails the file as before.
 */
export function contextEventsSource(): EventsSource | undefined {
  return fromContext(ctx => ctx.eventsSource)
}

/**
 * The user-preferences store on the context, or undefined (#410). The daemon/foreground wire
 * the real registry file; a public host (the relay) leaves it unset, so the preferences RPCs
 * degrade to a read-only default / a no-op write on a shared host.
 */
export function contextPreferences(): PreferencesStore | undefined {
  return fromContext(ctx => ctx.preferences)
}

/**
 * The quota source on the context, or undefined (#533). The daemon wires a live
 * poller; a public host (the relay) leaves it unset, since it has no agent to ask
 * and no business reading someone else's account.
 */
export function contextQuota(): QuotaSource | undefined {
  return fromContext(ctx => ctx.quota)
}
