import type { IncomingMessage, ServerResponse } from 'node:http'
import { config } from 'telefunc'
import { Telefunc } from 'telefunc/node'
import { hostnameFromHostHeader, isLoopbackHost } from '../loopback-host.js'
import { registerDashboardTelefunctions } from '../dashboard-rpc/register.js'
import type { ProjectsProvider } from './projects.js'
import type { FrameworkEvent } from '../events.js'
import type { PreferencesStore } from '../registry.js'
import type { DiscordCredentialsStore } from '../discord-credentials.js'
import type { QuotaSource } from './quota.js'
import type { AutoPmReporter } from '../auto-pm.js'
import type { AddProjectResult, PreviewResult, PreviewStatus, StartRunKind, StartRunOptions, StartRunResult } from './types.js'
import type { ServeTarget } from '../preview.js'
import type { RunMeta } from '../store/index.js'

/** Wired by the daemon so `sendStart` can reach the daemon's own `startRun` closure. */
export type StartRunHandler = (
  prompt: string,
  kind: StartRunKind,
  options: StartRunOptions,
  projectId?: string,
) => StartRunResult | Promise<StartRunResult>

/** Wired by the daemon so `sendAddProject` can install + register a repo (#433). */
export type AddProjectHandler = (path: string, directory: boolean) => AddProjectResult | Promise<AddProjectResult>

/** Wired by the daemon so the Preview RPCs can serve/stop/report a project's app (#475). */
export interface PreviewHandlers {
  /** `runId` serves that session's own worktree instead of the project's checkout (#797). */
  start: (projectId?: string, targetId?: string, runId?: string) => PreviewResult | Promise<PreviewResult>
  /** List the servable apps (#651) for the Serve picker in a multi-package repo. */
  targets: (projectId?: string, runId?: string) => ServeTarget[] | Promise<ServeTarget[]>
  stop: (projectId?: string, runId?: string) => void | Promise<void>
  status: (projectId?: string, runId?: string) => PreviewStatus | Promise<PreviewStatus>
}

/** Resolve a run to its live event stream: the relay feeds `onEvents` from its own in-memory stream
 * rather than a file on disk (#426), and the daemon feeds a run it is relaying from a device (#1067).
 * Returns undefined when there is no in-memory stream, so `onEvents` falls back to tailing the log. */
export type EventsSource = (projectId: string, runId?: string) => AsyncIterable<FrameworkEvent> | undefined

/** Look up the device a relayed run (#1067) executes on, or undefined for an ordinary local run. The
 *  daemon wires this from its live relayed-run map; a run-scoped RPC uses it to forward a remote run's
 *  read/steer/handoff to that device instead of resolving a (nonexistent) local checkout. */
export interface RemoteRuns {
  target(runId: string | undefined): { url: string; token: string } | undefined
  /** A project's relayed run stubs (#1077), so `onRuns` can show a remote run in the list and re-open it after a reload. */
  list(projectId: string): RunMeta[]
}

/**
 * The Telefunc request context the mount provides. `sendStart` reads `startRun` from it;
 * every project-keyed RPC reads `projects` (#427) — the daemon leaves it unset to use the
 * global registry, the per-run foreground dashboard passes a single-project provider. The
 * relay passes `eventsSource` (#426) so `onEvents` streams its in-memory run instead of a
 * file, plus an empty `projects` so the file/registry RPCs return nothing on a public host.
 */
export interface DashboardContext {
  startRun?: StartRunHandler
  addProject?: AddProjectHandler
  /** The Preview handler set (#475); the daemon wires it, other hosts leave it unset. */
  preview?: PreviewHandlers
  projects?: ProjectsProvider
  eventsSource?: EventsSource
  /** The relayed-run lookup (#1067 slice 2): only the daemon wires it, so a run-scoped RPC can tell a
   *  local run from one running on a connected device and forward the call there. */
  remote?: RemoteRuns
  /** The user-preferences store (#410). The daemon/foreground wire the real registry file;
   * a public host (the relay) leaves it unset so `onPreferences`/`savePreferences` are inert. */
  preferences?: PreferencesStore
  /** The quota source behind the usage panel (#533). The daemon wires a live poller;
   * a public host (the relay) leaves it unset, so `onQuota` reports it has no reading. */
  quota?: QuotaSource
  /** The Discord credentials store (#1095). The daemon wires one that also reloads its Discord
   * services on a save; a public host leaves it unset, so nothing there is configurable. */
  discord?: DiscordCredentialsStore
  /** What auto PM last decided (#1161). Only the daemon runs the sweep, so only it wires this. */
  autoPm?: AutoPmReporter
  /**
   * Run an auto PM sweep now rather than at the next interval (#1210). Same reason `autoPm` is
   * daemon-only: the loop lives in that process, so nowhere else has one to fire. Resolves when
   * the sweep does (#1433), so the trigger RPC can await it and return what it decided.
   */
  autoPmSweep?: (opts?: { drainOnly?: boolean }) => void | Promise<void>
}

let instance: Telefunc | undefined

function setup(): Telefunc {
  if (instance) return instance
  // No Vite build runs over these functions, so there are no generated shields; the
  // mount is localhost-only and same-origin guarded, and every write funnels through
  // appendControl / the busy-guarded startRun. Disable shield generation and the
  // naming convention (our names are `onX`/`sendX`, not telefunc's query/mutation hint).
  ;(config as { shield?: unknown }).shield = { dev: false, prod: false }
  ;(config as { disableNamingConvention?: boolean }).disableNamingConvention = true
  registerDashboardTelefunctions()
  instance = new Telefunc()
  return instance
}

/**
 * CSRF guard for the state-changing Telefunc calls. A browser attaches an `Origin`
 * header to every cross-site request, so we reject any POST whose Origin is not this
 * same server (or a loopback host) — otherwise a page on `evil.com` could `fetch()` the
 * localhost dashboard and spawn/steer a run. An absent Origin means a non-browser caller
 * (curl, the test suite) with no ambient session to abuse, so it passes. Lives here beside
 * the mount, its only caller.
 */
export function isSameOriginRequest(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  const host = req.headers.host
  if (host && (origin === `http://${host}` || origin === `https://${host}`)) return true
  let hostname: string
  try {
    hostname = new URL(origin).hostname
  } catch {
    return false // malformed Origin: treat as cross-origin
  }
  return isLoopbackHost(hostname)
}

/**
 * DNS-rebinding guard, the other half of the CSRF check above. A page on `evil.com` whose DNS
 * re-answers as `127.0.0.1` is *same-origin* with this server as far as the browser is concerned,
 * so its `fetch()` takes the passing branch of {@link isSameOriginRequest} — and every RPC behind
 * the mount, `sendStart` included, is reachable from a page the user merely visited.
 *
 * The `Host` header is what still gives the attacker away: it carries the name the browser was
 * asked for (`evil.com`), not the address it resolved to. So when we are bound to loopback, the
 * only `Host` a real user's browser can send is a loopback one (or the bound address itself) —
 * anything else is a rebound name and is rejected. An absent `Host` is rejected too when we are
 * enforcing: HTTP/1.1 requires it, and every browser sends it.
 *
 * A non-loopback bind (`--host`, #1051) is reached by a hostname we cannot predict, so there is
 * no allowlist to check against; that case gates behind the shared daemon token instead. Hosts
 * that never pass a bind host at all (the relay, which serves a public domain) are unaffected.
 */
export function isExpectedHost(req: IncomingMessage, boundHost: string | undefined): boolean {
  if (boundHost === undefined || !isLoopbackHost(boundHost)) return true
  const header = req.headers.host
  if (!header) return false
  const hostname = hostnameFromHostHeader(header)
  return isLoopbackHost(hostname) || hostname === boundHost
}

/**
 * Mount the dashboard's Telefunc surface (#405) on the daemon's `node:http` server: one
 * `serve()` handles both the RPCs and the Channel SSE stream at `/_telefunc`. Telefunc
 * runs in the daemon process, so a `sendStart` telefunction can call the daemon's own
 * `startRun` via the request context. The `context` is exactly what each telefunction
 * reaches through {@link getContext} (see {@link DashboardContext}): the daemon wires the
 * full set, the relay passes only an events source plus an empty projects provider. Cross-
 * origin POSTs are rejected (CSRF: a page on evil.com must not steer or start a run), as are
 * requests carrying someone else's `Host` when we are bound to loopback (DNS rebinding: the
 * same page must not reach us by pointing its own name at `127.0.0.1`). Pass `opts.host` — the
 * address the server is bound to — to enable that second check; a host serving a public domain
 * (the relay) leaves it unset. Returns whether the request was Telefunc's.
 */
export function makeTelefuncMount(
  context: DashboardContext = {},
  opts: { host?: string } = {},
): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  return async (req, res) => {
    if (!isSameOriginRequest(req)) {
      res.writeHead(403, { 'content-type': 'text/plain' })
      res.end('cross-origin request forbidden')
      return true
    }
    if (!isExpectedHost(req, opts.host)) {
      res.writeHead(403, { 'content-type': 'text/plain' })
      res.end('unexpected Host header')
      return true
    }
    const tf = setup()
    // Never let a telefunc failure become an unhandled rejection that kills the daemon:
    // telefunc 0.2.22 throws on a bare `GET /_telefunc` (it passes the request as a body,
    // which `new Request()` rejects for GET), and a browser tab hits that on reconnect.
    try {
      return await tf.serve({ req, res, context: context as never })
    } catch {
      if (!res.headersSent) {
        res.writeHead(400, { 'content-type': 'text/plain' })
        res.end('bad telefunc request')
      } else {
        res.end()
      }
      return true
    }
  }
}
