import { basename, resolve } from 'node:path'
import { listProjects, projectId, readPreferences, readSecrets, type Preferences } from './registry.js'
import { resolveDiscordCredentials, type DiscordCredentials } from './discord-credentials.js'
import { errorMessage } from './error-message.js'
import { notifies, notifyCategoryEnabled } from './preference-defaults.js'
import { runOptionsFromPreferences, preferencesFromFileConfig } from './run-options.js'
import { loadFrameworkConfig } from './config.js'
import { readLiveMetas, listRuns, type LiveRun } from './store/index.js'
import { startKeyedWatcher, type KeyedWatcher } from './dashboard/keyed-watcher.js'
import { buildInterventions, interventionKey, postInterventionsDiscord } from './dashboard/interventions.js'
import { buildActivity, activityKey, postActivityDiscord } from './dashboard/activity.js'
import { startAutoPm, AUTO_PM_JOBS, DEFAULT_AUTO_PM_INTERVAL_MS, quotaHeadroom, type AutoPmReport } from './auto-pm.js'
import { startDaemonTick, DAEMON_TICK_MS } from './daemon-tick.js'
import { ciFixPrompt, startCiWatch } from './ci-watch.js'
import { releaseStalePinnedBranch } from './stale-branch.js'
import { maintenanceDue, readMaintenanceState, mergeMaintenanceState } from './maintenance.js'
import { promoteQueue } from './queue-promote.js'
import { FLAT_TODO_FILE, TICKETS_DIR } from './tickets.js'
import { acquireTicketLocks } from './ticket-locks.js'
import { readTickets } from './dashboard/tickets.js'
import { findTodoBacklog, nextQueuedTicket, ticketFromQueueEntry } from './todo-loop.js'
import { startSessionCommitter } from './session-commit.js'
import { startMergedWorktreeSweep, type MergedSweepOptions } from './merged-worktrees.js'
import { resolveRunPr } from './dashboard/run-handoff.js'
import { sendChoice, sendMessage, sendStop } from './dashboard-rpc/control.telefunc.js'
import type { ProjectSummary } from './dashboard/projects.js'
import type { QuotaSource } from './dashboard/quota.js'
import type { StartRunOptions, StartRunResult } from './dashboard/types.js'

/**
 * Everything the daemon runs in the background beside serving the dashboard: the two Discord
 * notification watchers (#627), auto PM (#685/#773), the CI watch (#1418), the session-archive
 * committer (#912/#1179) and the worktree sweep (#1036).
 *
 * All of it used to sit inline in `runDaemon`, which meant its body was a lifecycle narrative with
 * ~200 lines of service wiring in the middle of it. Each of these is gated the same way (an env
 * var says *where*, a preference says *whether*), each reads its preference per tick so a header
 * toggle takes effect without a restart, and three of them start runs the same way — so they
 * belong together, and the daemon body is left with the sequence it actually owns.
 *
 * They share one clock (E4). Each used to own a `setInterval`, so six intervals ran side by side
 * with no single place to look when a sweep was not running; now each declares how many ticks it
 * wants between turns and `daemon-tick.ts` fires them.
 */

/** Ticks between auto-PM sweeps, and between worktree sweeps: both are ten-minute jobs. */
const AUTO_PM_EVERY = Math.round(DEFAULT_AUTO_PM_INTERVAL_MS / DAEMON_TICK_MS)

/** What the daemon needs back: the two shutdown phases, in the order the daemon's teardown needs them. */
export interface BackgroundServices {
  /**
   * Stop everything that could start or steer a run, before the daemon suspends the runs it owns.
   * Ordered first on purpose: auto PM or a Discord message arriving mid-shutdown would otherwise
   * start a run while we are busy stopping them.
   *
   * Resolves once the tick in flight has finished, so the sweeps are off the repo before the runs
   * are torn down — these jobs commit and push, and stopping their clock does not stop their turn.
   */
  quiesce: () => Promise<void>
  /**
   * Commit whatever the shutdown just archived (#912/#1179), after the runs have been stopped so
   * their last events are on disk. Returns how many projects were committed.
   */
  flushSessions: () => Promise<number>
  /**
   * Rebuild the Discord services against freshly-read credentials (#1095), so a token pasted into
   * the dashboard takes effect now rather than at the next daemon start. Idempotent and safe to
   * call when nothing changed: the watchers re-seed their baseline on the first poll, so a restart
   * never replays the open backlog as new notifications.
   */
  reloadDiscord: () => Promise<void>
  /**
   * Sweep now instead of at the next tick (#1161), because the `autoPm` preference was just
   * switched on. The sweep re-reads the preference itself, so this only changes *when* it
   * notices — but a ten-minute wait with nothing on screen is what made the toggle read as dead.
   *
   * `onDemand` is the dashboard's trigger button (#1210): that sweep runs even while the
   * preference is off, because the click itself is the ask the preference would otherwise record.
   *
   * Resolves when the tick does (#1433), so the trigger button can await the sweep and say what
   * it decided; the switched-on-preference wake simply does not await it.
   */
  wakeAutoPm: (opts?: { onDemand?: boolean; drainOnly?: boolean }) => Promise<void>
  /** What the last auto-PM sweep decided, for the usage panel to show (#1161). */
  autoPmReport: () => AutoPmReport
}

/** What {@link startBackgroundServices} needs from the daemon. */
export interface BackgroundServiceDeps {
  /** The daemon's home workspace. Chat has no project picker, so a message with no run starts one here. */
  cwd: string
  env: NodeJS.ProcessEnv
  /** The dashboard's own URL, so a paused-run item (#636) can link back to it. */
  dashboardUrl: string
  /** The long-lived quota meter the usage panel draws; auto PM gates on the same reading. */
  quota: QuotaSource
  /** Start a run in a project. */
  startRun: (prompt: string, options: StartRunOptions, projectId: string) => Promise<StartRunResult>
  /** How many runs are live on a project, so a background job can tell idle from busy. */
  activeRunCount: (projectId: string) => number
  /**
   * The runs this daemon is still responsible for, whose checkouts the worktree sweep must leave
   * alone. See {@link MergedSweepOptions.busy}.
   */
  busyRunIds: () => ReadonlySet<string>
  log: (message: string) => void
}

/** The registered projects as dashboard summaries. */
async function listSummaries(env: NodeJS.ProcessEnv): Promise<ProjectSummary[]> {
  const records = await listProjects(undefined, env).catch(() => [])
  return records.map(p => ({ id: p.id, path: p.path, name: basename(p.path), activated: true }))
}

/** The user's preferences, or empty when they cannot be read — the defaults are what a run would use anyway. */
function readPrefs(env: NodeJS.ProcessEnv): Promise<Preferences> {
  return readPreferences(undefined, env).catch(() => ({}) as Preferences)
}

/**
 * The run options a project's settings imply (#858): the user's global tier, then the repo's
 * committed `the-framework.yml` (#842) on top. The same mapping and the same two tiers the launcher
 * uses, so a run started by the daemon and a run started by hand differ only in who asked for it.
 * An unreadable tier falls back to empty rather than failing the start: the defaults are what the
 * run would have used anyway.
 *
 * Exported for the daemon's continuation starts (#1467): a dashboard Resume sends only its seed
 * (`resumeSession` + `continueRunId`), so these are the base its options overlay.
 */
export async function resolveProjectRunOptions(id: string, env: NodeJS.ProcessEnv): Promise<StartRunOptions> {
  const global = await readPrefs(env)
  const path = (await listProjects(undefined, env).catch(() => [])).find(p => p.id === id)?.path
  const file = path ? await loadFrameworkConfig(path).catch(() => ({})) : {}
  return runOptionsFromPreferences({ ...global, ...preferencesFromFileConfig(file) })
}

export function startBackgroundServices(deps: BackgroundServiceDeps): BackgroundServices {
  const { env, log } = deps
  const projects = () => listSummaries(env)
  const prefs = () => readPrefs(env)

  /**
   * Start a run nobody is watching. `unattended` is forced on top of the project's settings rather
   * than read from them: it is a property of there being no human at the keyboard, not a
   * preference, and without it every choice gate parks forever on an answer that is not coming
   * (#846). All three background starters go through here, so none can forget either half.
   */
  const startUnattended = async (projectId: string, prompt: string, extra: StartRunOptions = {}) => {
    const options = await resolveProjectRunOptions(projectId, env)
    return deps.startRun(prompt, { ...options, ...extra, unattended: true }, projectId)
  }

  // Auto PM (#685/#773): while the queue is dry and there is quota to spare, triage and
  // plan tickets rather than let the day's allowance expire unused.
  const autoPm = startAutoPm({
    projects,
    jobs: AUTO_PM_JOBS,
    enabled: async () => (await prefs()).autoPm === true,
    // Which routines the user unticked (#1209). Global rather than per project, like the master
    // switch it sits under: the rotation is one schedule for the machine, not one per repo.
    optedOut: async () => (await prefs()).autoPmOptOut ?? [],
    // The queue's open entries rather than a bare emptiness bit: a batch of concurrent drains is
    // pinned one entry each (#1204), so the sweep needs the entries the decision was made on.
    queue: async project => (await findTodoBacklog(project.path))?.entries ?? [],
    activeRuns: project => deps.activeRunCount(project.id),
    // How many agents the routine may keep going per project (#1204). Global like the opt-outs;
    // the sweep applies the default when it is unset.
    concurrency: async () => (await prefs()).autoPmConcurrency,
    // The quota boundary is the gate (#879): auto PM has no budget notion of its own.
    quota: async () => (await deps.quota.read()).boundary,
    // The periodic codebase sweep (#882). The schedule is a file in the project checkout rather
    // than loop state, because unlike the rotation it has to survive a daemon restart: a machine
    // rebooted daily would otherwise sweep every morning and never reach its interval.
    maintenanceDue: async project => maintenanceDue(await readMaintenanceState(project.path), Date.now()),
    recordMaintenance: async project => mergeMaintenanceState(project.path, { sweptAt: new Date().toISOString() }),
    // A pinned routine branch left behind by a closed PR blocks every later firing (#1293).
    releasePinned: (project, branch) => releaseStalePinnedBranch(project.path, branch),
    // The tickets a [Plan tickets] fan-out may claim (#1327/#1420): unplanned and not claimed
    // by a `.lock.md` — most important first. No stale-lock sweep runs here: #1420
    // removed the timer, so a lock stands until the agent's PR deletes it or a human releases
    // it from the dashboard.
    planCandidates: async project => {
      const rank = (priority?: string) => {
        const n = Number(priority)
        return Number.isFinite(n) ? n : -1
      }
      return (await readTickets(project.path))
        .filter(ticket => !ticket.planned && !ticket.locked)
        .sort((a, b) => rank(b.priority) - rank(a.priority))
        .map(ticket => ticket.file)
    },
    // The daemon writes and pushes the locks, never the agent (#1327/#1320): an agent only
    // pushes at the end of its session onto its own branch, and a claim that stayed local would
    // not reach the machines it exists for.
    lockPlans: (project, assignments) => acquireTicketLocks(project.path, assignments, { log }),
    start: async (project, job) => {
      // A draining run works one open queue entry, and since #1164 that entry links back to the
      // ticket it was queued from — so this is the one moment the framework knows what a run is
      // about to implement, and can say so on the run's meta (#1117). A sweep-built drain names its
      // own pinned entry (#1204), so the #1117 lane keeps working with several drains in flight;
      // the first-open-entry read is the fallback for a drain job wired without one. Every other
      // job puts work on the queue rather than taking it off, so there is nothing to name.
      const ticket = job.drains
        ? job.entry !== undefined
          ? ticketFromQueueEntry(job.entry)
          : await nextQueuedTicket(project.path).catch(() => undefined)
        : // A fanned-out plan agent is pinned to one ticket too (#1327), so its meta names it the
          // same way a pinned drain's does.
          job.ticket !== undefined
          ? `${TICKETS_DIR}/${job.ticket}`
          : undefined
      // The pinned entry itself also rides along (#1253), so the claim on it reaches the run's
      // meta and outlives both this process's memory and the run's local process.
      const result = await startUnattended(project.id, job.prompt, {
        ...(ticket ? { ticket } : {}),
        // A fanned-out plan agent plans its ticket rather than implementing it (#1327), so its PR
        // title must not inherit the issue as `(fix #42)` — the plan's merge would close the
        // issue with the work still undone (#1334).
        ...(ticket && !job.drains ? { planRun: true } : {}),
        // The job says its PRs may land themselves (#1216): the drain implements work whose
        // review already happened on the queue. Rides to the run as the ladder's top rung.
        ...(job.autoMerge ? { handoff: 'merge' as const } : {}),
      })
      return result.ok ? result.runId : undefined
    },
    // The daemon promotes the queue, never the agent (#852): the run stays sandboxed in its
    // worktree, and one known file is copied across once it has finished cleanly.
    promote: async (project, { runId, entry }) => {
      const run = (await listRuns(project.path).catch(() => [])).find(r => r.id === runId)
      // Unknown or still going: not settled, so it is tried again next tick.
      if (!run || run.status === 'running') return { settled: false, promoted: false }
      // The entry it was pinned to travels with it (#1204), so the promotion lands that one entry
      // rather than the run's whole view of the queue.
      const outcome = await promoteQueue(project.path, { ...run, ...(entry !== undefined ? { entry } : {}) })
      if (!outcome.promoted) log(`[framework] auto PM: ${outcome.reason} (${runId})`)
      // A finished run is settled either way — one that wrote no queue is not going to start.
      // The exception (a checkout busy with the user's own queue edits) is the callee's to flag.
      const retry = !outcome.promoted && outcome.retry === true
      return { settled: !retry, promoted: outcome.promoted }
    },
    log,
  })

  // Commit the session archives written into the main checkout (#912/#1179). A run's own worktree
  // sweeps its archive on teardown; nothing did the same for one held in the checkout itself, so it
  // sat as an uncommitted change until a human noticed. Path-scoped and debounced, and it skips a
  // repo that is mid-rebase or index-locked rather than committing into someone's work.
  const sessionCommitter = startSessionCommitter({ projects, log })

  // Watch the PRs the framework is waiting to land (#1418): merge a `watched` PR once its checks
  // pass (the #1417/#1406 answer for repos without GitHub auto-merge), and put an agent on a
  // watched PR whose checks fail. The merge half runs ungated — it finishes a merge the run was
  // already armed and authorized for. The fix half starts runs on its own, so it takes the same
  // consent the other self-starting work does: the `autoPm` preference (read per attempt, like
  // every other per-tick gate here) and quota headroom.
  const ciWatch = startCiWatch({
    projects,
    log,
    deps: {
      fix: async (cwd, request) => {
        if ((await prefs()).autoPm !== true) return undefined
        const boundary = (await deps.quota.read().catch(() => undefined))?.boundary
        if (!quotaHeadroom(boundary).start) return undefined
        const project = (await projects()).find(p => p.path === cwd)
        if (!project) return undefined
        // The fix lands on the red PR's own branch, so this run's handoff must not push or open
        // anything of its own.
        const result = await startUnattended(project.id, ciFixPrompt(request), { handoff: 'local' })
        return result.ok ? result.runId : undefined
      },
    },
  })

  // Reclaim the checkout of a session whose work is on the remote (#1036/E5): the branch and the
  // session's row are kept, so this frees disk rather than throwing work away. It is the retry for
  // a push that could not land at teardown.
  const mergedWorktrees = startMergedWorktreeSweep({ projects, log, busy: deps.busyRunIds })

  // `resolve` matters: projectId hashes the path string, and `--cwd` reaches us verbatim, so a
  // relative path would hash to an id no project lookup can resolve. Same derivation the runtime uses.
  const homeId = projectId(resolve(deps.cwd))
  const projectPath = async (id: string) => (await projects()).find(p => p.id === id)?.path ?? deps.cwd

  /**
   * Everything that needs a Discord credential, as one group that can be stopped and rebuilt
   * (#1095). It is a group rather than four independently-managed services because they share the
   * two credentials and nothing else here does: when a token is pasted into the dashboard, this is
   * exactly the set that has to come up, and when one is cleared, exactly the set that has to go.
   */
  const startDiscord = (credentials: DiscordCredentials) => {
    const { webhook } = credentials

    // Discord notifications (#627): fire on new "needs you" items even when no dashboard is open.
    // Two gates — the webhook (where to post) and the per-user preference (whether to). The
    // preference is checked at post time, not at watcher start, so the header toggle takes effect
    // without a daemon restart; the watcher keeps observing while off, so flipping it on starts from
    // now rather than blasting the whole open backlog.
    const built: KeyedWatcher[] = webhook
      ? [
          startKeyedWatcher({
            projects,
            build: items => buildInterventions(items, { dashboardUrl: deps.dashboardUrl }),
            keyOf: interventionKey,
            onNew: async items => {
              if (!notifies(await prefs(), 'discord', 'humanIntervention')) return
              const delivered = await postInterventionsDiscord(webhook, items).catch(() => false)
              if (!delivered) log('[framework] could not post a needs-you batch to the Discord webhook')
            },
          }),
          startKeyedWatcher({
            projects,
            build: buildActivity,
            keyOf: activityKey,
            onNew: async items => {
              if (!notifies(await prefs(), 'discord', 'newActivity')) return
              const delivered = await postActivityDiscord(webhook, items).catch(() => false)
              if (!delivered) log('[framework] could not post an activity batch to the Discord webhook')
            },
          }),
        ]
      : []

    // Held rather than returned, because the clock's job list is fixed at construction while this
    // set is rebuilt whenever a credential changes: the job polls whatever is here now.
    discordWatchers = built
    return () => {
      for (const watcher of built) watcher.stop()
      if (discordWatchers === built) discordWatchers = []
    }
  }

  let discordWatchers: KeyedWatcher[] = []

  let stopDiscord = () => {}
  let stopped = false
  /**
   * Rebuild against the credentials as they are now. Chained rather than run concurrently: two
   * saves landing together would otherwise interleave a start with a stop and leave a gateway
   * socket nobody holds a handle to.
   */
  let reloading: Promise<void> = Promise.resolve()
  const reloadDiscord = () => {
    reloading = reloading
      .then(async () => {
        if (stopped) return
        const credentials = resolveDiscordCredentials(env, await readSecrets(undefined, env).catch(() => ({})))
        stopDiscord()
        stopDiscord = startDiscord(credentials)
      })
      .catch(err => log(`[framework] could not reload the Discord services: ${errorMessage(err)}`))
    return reloading
  }

  // The group comes up through the same reload path the dashboard uses, rather than a second
  // start-up copy of it: resolving the stored half needs a registry read, and the daemon must not
  // block its start-up on one. Until it lands there is simply no Discord, which is the state a
  // daemon with no credentials stays in anyway.
  void reloadDiscord()

  // One clock for every background job (E4). Each says how many ticks it wants between turns
  // instead of owning an interval, so there is one place to look when the answer to "why is
  // nothing happening" is that a sweep is not running — and the ratios are exact rather than six
  // timers drifting apart.
  const clock = startDaemonTick({
    log,
    // Order matters on the start-up tick, which runs before anything else the daemon does: the
    // worktree sweep goes first, so its start-up turn lands while the daemon owns no runs at all.
    // Behind a slow job it would instead land in the middle of the first session, racing that
    // session's teardown for the same checkout — which the `busy` guard then has to catch.
    jobs: [
      // Ten minutes. Its start-up turn is the point: the case it exists for is a machine that was
      // off (or a daemon that was down) while a session's push could not land.
      { name: 'worktree sweep', every: AUTO_PM_EVERY, run: () => mergedWorktrees.tick() },
      // The finest cadence, and what the base tick is set by: the committer's idle window is a
      // poll seeing the same pending set twice, so its window *is* one tick.
      { name: 'session commit', run: () => sessionCommitter.poll() },
      // ~1 min, the CI latency agreed on #1418.
      { name: 'CI watch', every: 2, run: () => ciWatch.tick() },
      // The watched things change slowly and a poll costs a read per project. Their first turn is
      // the baseline seed, which must happen at start-up or the whole open backlog reads as new.
      { name: 'Discord watchers', every: 2, run: async () => { for (const w of discordWatchers) await w.poll() } },
      // Ten minutes. Its start-up turn matters too: a daemon started with the setting already on
      // would otherwise sit idle with quota going spare (#1161).
      { name: 'auto PM', every: AUTO_PM_EVERY, run: () => autoPm.tick() },
    ],
  })

  return {
    quiesce: async () => {
      stopped = true
      await clock.stop()
      stopDiscord()
      autoPm.stop()
      // The CI watch can start fix runs, so it stops with the other run-starters.
      ciWatch.stop()
      mergedWorktrees.stop()
      // Stopped before `flushSessions` below, so that is a single flush past the idle window
      // rather than a wait for a turn that is no longer coming.
      sessionCommitter.stop()
    },
    flushSessions: () => sessionCommitter.flush().catch(() => 0),
    reloadDiscord,
    // Awaitable (#1433) so the trigger button can wait for the sweep's answer; a caller that
    // does not care simply drops the promise. The plain wake is safe to call when the preference
    // went the other way — the sweep re-reads the box, records "off", and starts nothing — while
    // an on-demand one (#1210) runs regardless, because the click is the ask.
    wakeAutoPm: opts => autoPm.tick(opts).catch(() => {}),
    autoPmReport: () => autoPm.report(),
  }
}

