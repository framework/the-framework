import { resolve } from 'node:path'
import { stat } from 'node:fs/promises'
import { fromDiaryLine, projectBranches, resolveAgentDiary, type AgentMeta, type AnyDiaryLine } from './store/index.js'
import type { FrameworkEvent } from './events.js'
import type { StartAgentOptions, StartAgentResult, AddProjectResult } from './dashboard/index.js'
import type { EventsSource, RemoteAgents } from './dashboard/rpc-serve.js'
import { RelayedAgents, startRemoteAgent } from './dashboard/remote-run.js'
import { dispatchRelayRpc } from './dashboard-rpc/relay-dispatch.js'
import { tailAgentEvents } from './dashboard-rpc/events-tail.js'
import { addProject, listProjects, projectId } from './registry.js'
import { installProject } from './install.js'
import { runProjectHooks, runStartHook } from './project-hooks.js'

/**
 * What the daemon does for a project (#393): start a run, add a project, and relay a run to and
 * from a connected device. Split from daemon.ts so that file reads as the daemon's lifecycle
 * (state file, ports, boot, shutdown). The daemon runs no agent itself (#1774): a Start is the
 * project's own `start` hook line, and the run it begins belongs to whatever tool that line names.
 */

/** Inputs to {@link createProjectRuntime}. */
export interface ProjectRuntimeOptions {
  /** The daemon's home workspace; a run with no project id targets it. */
  cwd: string
  /** Env for the registry lookups (#393). */
  env: NodeJS.ProcessEnv
}

/** The per-project surface the dashboard drives, plus its teardown. */
export interface ProjectRuntime {
  onStart: (prompt: string, options?: StartAgentOptions, targetProjectId?: string) => Promise<StartAgentResult>
  onAddProject: (path: string) => Promise<AddProjectResult>
  /** The live event stream for an agent this daemon is relaying from a device (#1067), else undefined
   *  so `onEvents` falls back to tailing the on-disk log. Wired as the dashboard's events source. */
  remoteEventsSource: EventsSource
  /** Tail a relay-started agent's on-disk events (#1067): the daemon's `/_relay/events` endpoint uses
   *  it to stream one agent back to whichever daemon relayed it here. */
  tailRelayEvents: (agentId: string, onEvent: (event: FrameworkEvent) => void) => () => void
  /** The relayed-agent lookup the dashboard's read RPCs consult (#1067 slice 2): which device a remote
   *  run runs on, so a run-scoped RPC forwards there instead of resolving a local checkout. */
  remoteAgents: RemoteAgents
  /** The device side of the relay (#1067 slice 2): run one whitelisted read/steer/handoff RPC against
   *  this daemon's own home checkout, for a daemon that relayed an agent here. */
  onRelayRpc: (fn: string, args: unknown[]) => Promise<unknown>
  /** Let go of the relayed streams. */
  dispose: () => Promise<void>
}

/**
 * The daemon's per-project runtime (#393). The home `cwd` is the default target: a request with
 * no project id (or the home id) resolves to it without a registry lookup.
 */
export function createProjectRuntime({ cwd, env }: ProjectRuntimeOptions): ProjectRuntime {
  const homeId = projectId(resolve(cwd))
  // Runs this daemon is relaying to/from a connected device (#1067): the local half of a remote agent.
  const relayedAgents = new RelayedAgents()
  // The relayed-agent lookup the dashboard's read RPCs consult (#1067 slice 2): is this agentId remote, and
  // which device owns it. Outlives the event stream so a finished remote agent's push/PR still reaches it.
  const remoteAgents: RemoteAgents = {
    target: agentId => relayedAgents.target(agentId),
    list: projectId => relayedAgents.list(projectId),
  }
  // The device side of the relay (#1067 slice 2): run one whitelisted read/steer/handoff RPC against this
  // daemon's own home checkout, for a daemon that relayed an agent here. Home id forces the addressed project.
  const onRelayRpc = (fn: string, args: unknown[]): Promise<unknown> => dispatchRelayRpc(homeId, fn, args)

  // A project id resolves to its repo path via the registry; the home id (or none)
  // resolves to the daemon's own `cwd` without a lookup.
  const resolveProject = async (id: string | undefined): Promise<string | undefined> => {
    if (!id || id === homeId) return cwd
    const records = await listProjects(undefined, env).catch(() => [])
    return records.find(record => record.id === id)?.path
  }

  // Start (#1774): the project's own `start` hook line, which answers the id of the run it began.
  // The daemon names no tool and holds nothing about the run: no slot, no cap (a person's click is
  // the brake), no process to stop at shutdown. A project without the line cannot start a run here.
  const onStart = async (prompt: string, options: StartAgentOptions = {}, targetProjectId?: string): Promise<StartAgentResult> => {
    // Run on a connected device (#1067): forward the start to the remote daemon, which runs its own
    // project's hook, and relay the run's events back. `remote` is stripped so the device does not
    // relay onward. The device starts it in its own home project.
    if (options.remote) {
      const { remote, ...forwarded } = options
      const result = await startRemoteAgent(remote, { prompt, options: forwarded })
      if (result.ok) {
        // A relayed agent has no local checkout or pid, so its list row is a memory-only stub (#1077):
        // registered here so onAgents can show it and a dashboard reload re-opens it. Never written to disk.
        const now = new Date().toISOString()
        const meta: AgentMeta = {
          status: 'running',
          id: result.agentId,
          startedAt: now,
          updatedAt: now,
          target: 'remote',
          intent: prompt,
          ...(remote.label ? { remoteLabel: remote.label } : {}),
        }
        relayedAgents.register(result.agentId, remote, meta, targetProjectId ?? homeId)
      }
      return result
    }
    const projectCwd = await resolveProject(targetProjectId)
    if (!projectCwd) return { ok: false, error: `unknown project: ${targetProjectId}` }
    const started = await runStartHook(projectCwd, {
      prompt,
      ...(options.driver !== undefined ? { driver: options.driver } : {}),
      ...(options.model !== undefined ? { model: options.model } : {}),
      ...(options.then !== undefined ? { then: options.then } : {}),
    })
    // The line made a checkout (or is about to): the project's checkouts are read again on the
    // next look rather than a few seconds from now, so the new run's page finds its own.
    if (started.ok) projectBranches.changed(projectCwd)
    return started.ok ? { ok: true, agentId: started.id } : { ok: false, error: started.error }
  }

  // Add a project (#396): install the repo, then register it so it appears in the Projects
  // list. installProject is idempotent (an already-activated repo is a no-op success).
  const onAddProject = async (path: string): Promise<AddProjectResult> => {
    // Resolve relative input against the daemon cwd, and check the directory really
    // exists first: without this a bad path reaches git as a missing cwd, which
    // surfaces as the confusing "spawn git ENOENT" rather than a path error.
    const abs = resolve(path)
    const isDir = await stat(abs).then(s => s.isDirectory()).catch(() => false)
    if (!isDir) return { ok: false, error: `path does not exist or is not a directory: ${abs}` }
    const result = await installProject(abs)
    if (!result.ok) return { ok: false, error: result.error }
    await addProject(abs, new Date().toISOString()).catch(() => {})
    // The project's open hooks (#1774): a project added while the daemon runs is a project the
    // boot never saw, so its open lines run now, the way they would have at boot.
    await runProjectHooks(abs, 'open', { log: console.log })
    return { ok: true, alreadyActivated: result.alreadyActivated === true }
  }

  // The dashboard's events source (#1067): a stream for an agent this daemon is relaying from a device,
  // else undefined so `onEvents` tails the on-disk log as usual for an ordinary local agent.
  const remoteEventsSource: EventsSource = (_projectId, agentId) => relayedAgents.get(agentId)

  // Tail a relay-started run's own log (#1067) for the `/_relay/events` endpoint: the diary the
  // run's tool keeps, its lines turned into events. The relocating tail, for the same reason as
  // the dashboard's onEvents: the diary becomes the finished run's when the run ends.
  const tailRelayEvents = (agentId: string, onEvent: (event: FrameworkEvent) => void): (() => void) =>
    tailAgentEvents<AnyDiaryLine>(() => resolveAgentDiary(cwd, agentId), line => onEvent(fromDiaryLine(line)))

  const dispose = async (): Promise<void> => {
    relayedAgents.dispose()
  }

  return { onStart, onAddProject, remoteEventsSource, tailRelayEvents, remoteAgents, onRelayRpc, dispose }
}
