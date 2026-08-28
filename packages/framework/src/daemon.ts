import { mkdir } from 'node:fs/promises'
import { basename, join, relative, isAbsolute } from 'node:path'
import type { FrameworkEvent } from './events.js'
import { isPidAlive, reconcileOrphanedAgents } from './store/index.js'
import { THE_FRAMEWORK_DIR } from './framework-dir.js'
import { startDashboard, type Dashboard, type StartAgentOptions } from './dashboard/index.js'
import { createProjectRuntime, type ProjectRuntimeOptions } from './daemon-runtime.js'
import { defaultQuotaSource } from './dashboard/quota.js'
import { startBackgroundServices, type BackgroundServices } from './daemon-services.js'
import { projectErrorStore } from './project-errors.js'
import { resolveDashboardBundle } from './dashboard/bundle.js'
import { isActivated } from './project.js'
import { addProject, ensureDaemonToken, listProjects, nodeRegistryFs, readPreferences, registryPreferencesStore, type Preferences } from './registry.js'
import { registryDiscordCredentialsStore } from './discord-credentials-store.js'
import { JsonlTailer } from './jsonl-tail.js'
import { isLoopbackHost } from './loopback-host.js'
import { bridgeSessionsFrom } from './dashboard/bridge-sessions.js'
import { bridgeQuestions } from './dashboard/bridge-store.js'
import { bridgeBrowserDir, bridgeBrowserOwner, startBridgeBrowser, type BridgeBrowser, type BridgeBrowserOptions } from './bridge-browser.js'
import { closeOrphanedAgentBrowsers } from './browser.js'
import { readAllAgents } from './store/index.js'
import type { BridgeSession } from './dashboard/index.js'

/**
 * The dashboard process (#302). It is a pure projection of the store: a session appends its
 * events to `.the-framework/events.jsonl`, and the dashboard *tails* that file, pushing each
 * new event to connected browsers. No session<->dashboard IPC — the file is the seam, matching
 * "the dashboard is a projection of the event stream". Steering goes the other way through
 * `.the-framework/control.jsonl` (#344).
 *
 * It runs in the foreground and only in the foreground: Ctrl-C closes the dashboard and every
 * session it is running. There is no detached mode, so there is no liveness record, no
 * machine-global state file, and no second process to find, reuse or stop.
 *
 * Sessions and steering are keyed per project: it spawns each session with `--cwd <project
 * path>` and appends its control entries to that project's own `control.jsonl`. Its own `cwd`
 * is just the home project it streams by default.
 */

/** The default dashboard port the daemon binds. */
export const DEFAULT_DAEMON_PORT = 4200

/** The default bind host (#1051): localhost only, so the daemon is unreachable off the machine. */
export const DEFAULT_DAEMON_HOST = '127.0.0.1'

/**
 * True when `host` is a loopback address the browser reaches without leaving the machine (#1051).
 * Defined in its own leaf module so the dashboard's RPC mount can share the one definition without
 * importing this one back (a cycle); re-exported here for the callers that already had it.
 */
export { isLoopbackHost }

/** Where the dashboard came up, reported to {@link RunDaemonOptions.onListening}. */
export interface DaemonState {
  /** The daemon process id. */
  pid: number
  /** The port the dashboard is bound to. */
  port: number
  /** The URL to open. */
  url: string
  /** ISO timestamp the daemon started. */
  startedAt: string
  /** The host the dashboard is bound to (#1051). */
  host?: string
}

/** The `.the-framework/` directory for a workspace. */
function daemonDir(cwd: string): string {
  return join(cwd, THE_FRAMEWORK_DIR)
}

/** True when `child` lives strictly inside `parent` (not equal, not outside). */
export function isNestedWithin(child: string, parent: string): boolean {
  const rel = relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * Make sure an activated home workspace shows up in the Projects list (#392). Best-effort
 * and idempotent (addProject dedupes by path), so it never blocks the daemon coming up.
 *
 * Skips a cwd that lives inside an already-tracked project (#647): the daemon creates
 * `.the-framework/` for its own state, so running it from a subfolder of a repo (e.g. the
 * package dir the binary lives in) would otherwise keep re-adding a nested duplicate.
 */
export async function registerHomeProject(cwd: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (!(await isActivated(cwd).catch(() => false))) return
  const existing = await listProjects(undefined, env).catch(() => [])
  if (existing.some(p => isNestedWithin(cwd, p.path))) return
  await addProject(cwd, new Date().toISOString(), undefined, env).catch(() => {})
}

/** True when a process with this id is still running (best-effort, signal 0). The store's
 * {@link isPidAlive} under the daemon's historical public name -- the two were byte-identical. */
export { isPidAlive as isProcessAlive } from './store/index.js'

/**
 * Tails the append-only `.the-framework/events.jsonl` agent log. The generic tailing
 * lives in {@link JsonlTailer}; this keeps the event-typed name the daemon (and
 * public API) always had.
 */
export class EventTailer extends JsonlTailer<FrameworkEvent> {}

/** Options for {@link runDaemon}. */
export interface RunDaemonOptions {
  /** Port to bind. Default {@link DEFAULT_DAEMON_PORT}; pass `0` for an ephemeral port. */
  port?: number
  /** Host to bind (#1051). Default {@link DEFAULT_DAEMON_HOST}; a non-loopback address generates and
   * requires the shared token, and every route is then gated behind it. */
  host?: string
  /** Shut the daemon down when this aborts (in addition to SIGINT/SIGTERM). For tests. */
  signal?: AbortSignal
  /** The CLI entry script to re-invoke for a dashboard-started agent (#345). Default `process.argv[1]`. */
  binPath?: string
  /** Env the registry is read from. Default `process.env`; injectable for tests. */
  env?: NodeJS.ProcessEnv
  /** How a start checks the picked agent can run (#1326); default the real `preflight`. For tests. */
  driverPreflight?: ProjectRuntimeOptions['driverPreflight']
  /** Called once the server has bound, before it blocks. The only way a caller learns the port. */
  onListening?: (state: DaemonState) => void
  /** How the bridge browser is launched (#1332); default the real Chrome for Testing. For tests. */
  bridgeBrowser?: (opts: BridgeBrowserOptions) => Promise<BridgeBrowser>
}

/**
 * The daemon body, run in the foreground by bare `framework`. Serves the built dashboard bundle
 * (#405/#426): the SPA reads each project's `.the-framework/events.jsonl` over an event stream and
 * steers over control.jsonl, so the daemon just serves the files and spawns sessions. Resolves on
 * SIGINT/SIGTERM after tearing the dashboard down.
 */
export async function runDaemon(cwd: string, opts: RunDaemonOptions = {}): Promise<void> {
  const port = opts.port ?? DEFAULT_DAEMON_PORT
  const host = opts.host ?? DEFAULT_DAEMON_HOST
  const env = opts.env ?? process.env
  // #1051: a non-loopback bind reaches the network, where a daemon that spawns processes is RCE for
  // anyone who finds the port, so generate + persist the shared token the request guard requires. A
  // loopback bind needs none, so the local zero-config path stays byte-identical.
  const token = isLoopbackHost(host) ? undefined : await ensureDaemonToken(undefined, env)
  // The browser bridge (#1237). Opt-in, because it opens the daemon's one route reachable from
  // another origin. It reuses the same shared token (#1051) rather than minting a second one: the two
  // guard the same daemon, so a second secret would be another thing to rotate and leak without
  // narrowing anything. On a loopback bind that secret may not exist yet, hence ensure, not read.
  const bridgeOn = (await readPreferences(undefined, env).catch((): Preferences => ({}))).bridge === true
  const bridgeToken = bridgeOn ? await ensureDaemonToken(undefined, env) : undefined
  // Steering (#344): the daemon owns no run, so its Stop button and choice picks
  // append to `.the-framework/control.jsonl`; the live agent tails that file. Appends
  // are best-effort — a full disk must not take the dashboard down with it.
  // The event/control logs and the fs.watch all live under `.the-framework/` — create
  // it up front so the daemon works as the very first command in a fresh workspace
  // (before any run made the dir).
  await mkdir(daemonDir(cwd), { recursive: true })

  // Multi-project (#392): make sure an activated home repo shows up in the Projects list.
  await registerHomeProject(cwd, env)

  // Crash recovery (#642): a fresh daemon drives no in-flight run, so any run a dead
  // process left marked `running` is orphaned — it would show as active forever with a
  // no-op Stop. Reconcile them to `stopped` across every registered project at boot.
  for (const record of await listProjects(undefined, env).catch(() => [])) {
    const fixed = await reconcileOrphanedAgents(record.path).catch(() => 0)
    if (fixed > 0) console.log(`[framework] reconciled ${fixed} orphaned agent(s) in ${basename(record.path)}`)
  }
  // Browsers those agents left behind (#1719): a Chrome whose agent died by SIGKILL runs on
  // with nothing tracking it. Its throwaway profile marks it as ours; a parent that is not an
  // agent marks it as nobody's.
  const browsers = await closeOrphanedAgentBrowsers().catch((): [] => [])
  if (browsers.length > 0) console.log(`[framework] closed ${browsers.length} orphaned agent browser(s): pid ${browsers.map(b => b.pid).join(', ')}`)

  // Everything the dashboard drives per project — run spawning, project install, and app
  // previews — lives in the runtime, so this body stays about the daemon's own lifecycle.
  // Known only once the dashboard listens; the runtime reads it per spawn (#1328).
  let daemonUrl: string | undefined
  const runtime = createProjectRuntime({
    cwd,
    env,
    ...(opts.binPath !== undefined ? { binPath: opts.binPath } : {}),
    ...(opts.driverPreflight !== undefined ? { driverPreflight: opts.driverPreflight } : {}),
    daemonUrl: () => daemonUrl,
  })

  // The daemon serves the built dashboard bundle (#405/#426): the SPA reads each project's
  // `.the-framework/events.jsonl` over `GET /_rpc/events` and steers over control.jsonl, so there
  // is no in-process event stream to feed here. The runtime's RPCs reach the browser through the
  // dashboard context the mount is wired with. A missing bundle (a broken install) surfaces as a
  // 503 from the server.
  const clientBundleDir = await resolveDashboardBundle()
  // Owned here rather than left to the dashboard (#685): auto PM has to consult the same
  // long-lived meter the usage panel draws, and a second poller would double a rate-limited read.
  const quota = defaultQuotaSource()
  // The per-project error state (#1500): the background services write it, the dashboard reads it.
  const projectErrors = projectErrorStore()
  // The bridge browser (#1332): the daemon's own Chrome for Testing with the extension installed,
  // so a web run no longer needs the user's Chrome open. Created here, launched only once the
  // dashboard listens (the extension is told the daemon's address) and the preference says so.
  // It needs the bridge: without the token there is nothing to hand the extension.
  const bridgeBrowser = bridgeBrowserOwner(async report => {
    if (!bridgeToken || !daemonUrl) {
      // The token is minted at boot, from the bridge preference as it stood then (above). A bridge
      // switched on since is a restart away; a bridge that is off wants switching on first.
      const bridgeOnNow = (await readPreferences(undefined, env).catch((): Preferences => ({}))).bridge === true
      throw new Error(
        bridgeOnNow
          ? 'the browser bridge was switched on after the dashboard started — restart the dashboard, and the browser launches on its own'
          : 'turn the browser bridge on, then restart the dashboard',
      )
    }
    return (opts.bridgeBrowser ?? (o => startBridgeBrowser(o)))({ daemonUrl, token: bridgeToken, dir: bridgeBrowserDir(env), report })
  }, console.log)
  // Assigned below, read from the credentials store's `onChange` (#1095): the dashboard mount has
  // to exist before the services do, and a save can only arrive over a mount that is already up.
  let services: BackgroundServices | undefined
  const dashboard: Dashboard = await startDashboard({
    host,
    port,
    quota,
    onStart: runtime.onStart,
    onAddProject: runtime.onAddProject,
    // Relay an agent to/from a connected device (#1067): the events source streams an agent this daemon
    // is relaying, `remote` lets the read RPCs forward a remote agent's reads/steer/push to its device
    // (slice 2), and the `/_relay/*` endpoints let another daemon run + read + steer a session here.
    eventsSource: runtime.remoteEventsSource,
    remote: runtime.remoteAgents,
    relay: { tailEvents: runtime.tailRelayEvents, rpc: runtime.onRelayRpc },
    // The browser bridge (#1237): absent unless the preference is on, which 404s every route.
    ...(bridgeToken ? { bridgeToken, bridgeSessions: () => listBridgeSessions(env) } : {}),
    // Configure Discord from the dashboard (#1095). `onChange` is the half that makes the step
    // finishable in-product: the credential is written to the registry, then this daemon's own
    // Discord services are rebuilt against it, so the bot connects without a restart.
    discord: registryDiscordCredentialsStore({ env, onChange: () => services?.reloadDiscord() }),
    // Same idea for "Spend what's left on the roadmap" (#1161): the sweep re-reads the preference
    // per tick, so without this the box you just ticked sits there doing nothing for up to ten
    // minutes and reads as broken. Only on the write that switches it *on* — an unrelated setting
    // saved while it happens to be on is not a reason to go spend quota.
    preferences: registryPreferencesStore(nodeRegistryFs(), env, written => {
      if (written.autoPm === true) void services?.wakeAutoPm()
      // The bridge browser follows its switch the same way (#1332): on launches it, off closes it.
      if (written.bridgeBrowser === true) void bridgeBrowser.start()
      if (written.bridgeBrowser === false) void bridgeBrowser.stop()
    }),
    // Only the daemon runs the sweep, so only it can say what the sweep decided.
    autoPm: () => services?.autoPmReport(),
    // ...and only it can be asked to sweep now (#1210). On demand, not the plain wake the
    // switched-on preference above uses: the button is an explicit ask, so the sweep runs even
    // while auto-run is off — one sweep for the click, and the schedule stays off.
    autoPmSweep: opts => services?.wakeAutoPm({ onDemand: true, ...opts }),
    projectErrors: projectErrors.list,
    bridgeBrowser,
    ...(token ? { token } : {}),
    ...(clientBundleDir ? { clientBundleDir } : {}),
  })

  daemonUrl = dashboard.url
  try {
    const actualPort = Number(new URL(dashboard.url).port) || port
    opts.onListening?.({ pid: process.pid, port: actualPort, host, url: dashboard.url, startedAt: new Date().toISOString() })
  } catch (err) {
    // Startup failed after the port was bound. Tear the server down, or it keeps the event loop
    // alive: a zombie process squatting the port.
    await dashboard.close()
    throw err
  }

  // The bridge browser comes up in the background (#1332): its first launch downloads Chrome,
  // and the dashboard must not wait on that. Read here rather than with the bridge preference
  // above: the launch needs the address the dashboard only has now.
  if ((await readPreferences(undefined, env).catch((): Preferences => ({}))).bridgeBrowser === true) void bridgeBrowser.start()

  // Every background start is a verbatim prompt agent (#353): these are preset prompts and chat
  // text, not build intents to scaffold from.
  const startAgent = (prompt: string, options: StartAgentOptions, id: string) => runtime.onStart(prompt, 'prompt', options, id)

  // Everything that runs in the background beside serving the dashboard: the Discord watchers,
  // auto PM, and the conversation committer.
  //
  // Nothing is resumed at boot. Ctrl-C closed the last dashboard and every session it was running,
  // and that was a deliberate act — starting those sessions again behind the user's back is not
  // what they asked for. A stopped session keeps its worktree and branch, so it is theirs to
  // continue from the dashboard whenever they want it.
  services = startBackgroundServices({
    cwd,
    env,
    dashboardUrl: dashboard.url,
    quota,
    startAgent,
    activeAgentSlots: runtime.activeAgentSlots,
    busyAgentIds: runtime.busyAgentIds,
    projectErrors,
    log: console.log,
  })

  await waitForShutdown(opts.signal)

  // Nothing may start or steer an agent from here on, so the background services go first (#923):
  // auto PM or a Discord message arriving mid-shutdown would start one while we stop the rest.
  await services.quiesce()
  // Stop the agents this daemon spawned, before the previews they may be serving. Left running they
  // are orphans nothing tracks; stopped here they keep their worktree and branch, so the dashboard
  // can continue them on the next start.
  // Named (#1646): a process still alive here that the dashboard showed as finished is the one
  // fact that explains a slot the sweep could not account for, and the count alone hid it.
  const stopped = await runtime.stopAgents().catch((): string[] => [])
  if (stopped.length > 0) console.log(`[framework] stopped ${stopped.length} agent(s): ${stopped.join(', ')}`)
  // Archives need no flush pass here (#1582): teardown writes each one through the data branch's
  // funnel, committed and pushed the moment the session settles.
  // Stopped here as well as by the dashboard: a broken install serves 503s without ever taking
  // ownership of the source we handed in, and that poller would go on reading by itself.
  quota.stop()
  // The daemon's browser goes with the daemon (#1332): left running it would keep serving a
  // daemon that is gone, and the next daemon would find its profile held.
  await bridgeBrowser.stop()
  await runtime.dispose()
  await dashboard.close()
}

/** Resolve on SIGINT/SIGTERM, or when the optional abort signal fires. */
function waitForShutdown(signal?: AbortSignal): Promise<void> {
  return new Promise(resolvePromise => {
    if (signal?.aborted) return resolvePromise()
    const done = (): void => {
      process.off('SIGINT', done)
      process.off('SIGTERM', done)
      signal?.removeEventListener('abort', done)
      resolvePromise()
    }
    process.once('SIGINT', done)
    process.once('SIGTERM', done)
    signal?.addEventListener('abort', done, { once: true })
  })
}

/**
 * The cloud sessions the browser bridge's Driver tab should be serving (#1237, #1332).
 *
 * Across every registered project, because a cloud agent is not tied to the daemon's home
 * checkout, and best-effort per project so one unreadable repo cannot empty the list.
 */
async function listBridgeSessions(env: NodeJS.ProcessEnv): Promise<BridgeSession[]> {
  const projects = await listProjects(undefined, env).catch(() => [])
  const agents = (await Promise.all(projects.map(p => readAllAgents(p.path).catch(() => [])))).flat()
  return bridgeSessionsFrom(agents, new Date(), bridgeQuestions().pendingAnswerSessions())
}
