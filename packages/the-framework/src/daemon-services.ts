import { basename, resolve } from 'node:path'
import { listProjects, projectId, readPreferences, readProjectPreferences, readSecrets, resolvePreferences, type Preferences } from './registry.js'
import { resolveDiscordCredentials, type DiscordCredentials } from './discord-credentials.js'
import { errorMessage } from './error-message.js'
import { discordNotificationEnabled, notificationEnabled } from './preference-defaults.js'
import { runOptionsFromPreferences, preferencesFromFileConfig } from './run-options.js'
import { loadFrameworkConfig } from './config.js'
import { readSuspendedRuns, writeSuspendedRuns, resumableRuns, readLiveMetas, listRuns, type LiveRun } from './store/index.js'
import { startKeyedWatcher, type KeyedWatcher } from './dashboard/keyed-watcher.js'
import { buildInterventions, interventionKey, postInterventionsDiscord } from './dashboard/interventions.js'
import { buildActivity, activityKey, postActivityDiscord } from './dashboard/activity.js'
import { startAutoPm, AUTO_PM_JOBS, quotaHeadroom, type AutoPmReport } from './auto-pm.js'
import { ciFixPrompt, startCiWatch } from './ci-watch.js'
import { releaseStalePinnedBranch } from './stale-branch.js'
import { maintenanceDue, readMaintenanceState, mergeMaintenanceState } from './maintenance.js'
import { claimedQueueEntries, promoteQueue } from './queue-promote.js'
import { FLAT_TODO_FILE, TICKETS_DIR } from './tickets.js'
import { acquireTicketLocks } from './ticket-locks.js'
import { readTickets } from './dashboard/tickets.js'
import { cachedOpenPrFilePatches } from './dashboard/gh.js'
import { findTodoBacklog, nextQueuedTicket, ticketFromQueueEntry } from './todo-loop.js'
import { startConversationCommitter } from './conversation-commit.js'
import { startMergedWorktreeSweep } from './merged-worktrees.js'
import { resolveRunPr } from './dashboard/run-handoff.js'
import { readConversation } from './conversations.js'
import { startDiscordBot, DISCORD_VIA } from './discord/bot.js'
import { startDiscordReplyMirror } from './discord/reply-mirror.js'
import { snapshotLiveRun } from './discord/live-run.js'
import { postMessage } from './discord/rest.js'
import { sendChoice, sendMessage, sendStop } from './dashboard-rpc/control.telefunc.js'
import type { ProjectSummary } from './dashboard/projects.js'
import type { QuotaSource } from './dashboard/quota.js'
import type { StartRunOptions, StartRunResult } from './dashboard/types.js'

/**
 * Everything the daemon runs in the background beside serving the dashboard: the two Discord
 * notification watchers (#627), auto PM (#685/#773), the conversation committer (#912), and the
 * Discord chatbot (#680) with its reply mirror (#932).
 *
 * All of it used to sit inline in `runDaemon`, which meant its body was a lifecycle narrative with
 * ~200 lines of service wiring in the middle of it. Each of these is gated the same way (an env
 * var says *where*, a preference says *whether*), each reads its preference per tick so a header
 * toggle takes effect without a restart, and three of them start runs the same way — so they
 * belong together, and the daemon body is left with the sequence it actually owns.
 */

/** What the daemon needs back: the two shutdown phases, in the order the daemon's teardown needs them. */
export interface BackgroundServices {
  /**
   * Stop everything that could start or steer a run, before the daemon suspends the runs it owns.
   * Ordered first on purpose: auto PM or a Discord message arriving mid-shutdown would otherwise
   * start a run while we are busy stopping them.
   */
  quiesce: () => void
  /**
   * Commit whatever conversation the shutdown just ended (#912), after the runs have been stopped
   * so their last turns are on disk. Returns how many projects were committed.
   */
  flushConversations: () => Promise<number>
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
 * The run options a project's settings imply (#858): the global tier, then the repo's committed
 * `the-framework.yml` (#842), then the project's own overrides (#840) on top. The same mapping and
 * the same layer order the launcher uses, so a run started by the daemon and a run started by hand
 * differ only in who asked for it. An unreadable tier falls back to empty rather than failing the
 * start: the defaults are what the run would have used anyway.
 *
 * Exported for the daemon's continuation starts (#1467): a dashboard Resume sends only its seed
 * (`resumeSession` + `continueRunId`), so these are the base its options overlay.
 */
export async function resolveProjectRunOptions(id: string, env: NodeJS.ProcessEnv): Promise<StartRunOptions> {
  const global = await readPrefs(env)
  const project = await readProjectPreferences(id, undefined, env).catch(() => undefined)
  const path = (await listProjects(undefined, env).catch(() => [])).find(p => p.id === id)?.path
  const file = path ? await loadFrameworkConfig(path).catch(() => ({})) : {}
  return runOptionsFromPreferences(resolvePreferences({ ...global, ...preferencesFromFileConfig(file) }, project))
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
        ...(job.entry !== undefined ? { queueEntry: job.entry } : {}),
        // The job says its PRs may land themselves (#1216): the drain implements work whose
        // review already happened on the queue. Rides to the run as `--auto-merge`.
        ...(job.autoMerge ? { autoMerge: true } : {}),
      })
      return result.ok ? result.runId : undefined
    },
    // The durable half of the drain pins (#1253): entries claimed by run metas rather than this
    // process's memory. The PR lookup rides the #1257 cache, so a sweep costs at most one `gh`
    // read per open entry per TTL.
    claimedEntries: async (project, candidates) =>
      claimedQueueEntries(project.path, candidates, {
        runs: listRuns,
        pr: resolveRunPr,
        // The cross-machine leg (#1313): an open PR retires its entry whichever machine — or
        // cloud session — drained it. Rides the same #1028 cache as the PR lookups.
        queuePatches: path => cachedOpenPrFilePatches(path, FLAT_TODO_FILE),
      }),
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

  // Sweep once now rather than one interval from now (#1161): a daemon started with the setting
  // already on would otherwise sit idle for ten minutes with quota going spare, which is exactly
  // when it should be spending. Cheap and silent when the setting is off — it reads it and stops.
  void autoPm.tick().catch(() => {})

  // Commit the conversations recorded on the main checkout (#912). A run's own worktree already
  // sweeps its transcript on teardown; nothing did the same for a chat held in the checkout itself,
  // so it sat as an uncommitted change until a human noticed. Path-scoped and debounced, and it
  // skips a repo that is mid-rebase or index-locked rather than committing into someone's work.
  const conversationCommitter = startConversationCommitter({ projects, log })

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
        const result = await startUnattended(project.id, ciFixPrompt(request), {
          autoPushBranch: false,
          autoOpenPr: false,
          autoMerge: false,
        })
        return result.ok ? result.runId : undefined
      },
    },
  })

  // Reclaim the checkout of a session whose work has landed (#1036). A failed or stopped run keeps
  // its worktree so you can read what it was holding (#752), and nothing ever took those back — so
  // they accumulated one full checkout at a time. Once the branch is merged the checkout is the
  // only copy that costs disk and says nothing new; the branch and the session's row are kept, so
  // this reclaims space rather than throwing work away.
  const mergedWorktrees = startMergedWorktreeSweep({ projects, log })

  const botEnabled = async () => notificationEnabled(await prefs(), 'discordBot')
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
    const { webhook, botToken } = credentials

    // Discord notifications (#627): fire on new "needs you" items even when no dashboard is open.
    // Two gates — the webhook (where to post) and the per-user preference (whether to). The
    // preference is checked at post time, not at watcher start, so the header toggle takes effect
    // without a daemon restart; the watcher keeps observing while off, so flipping it on starts from
    // now rather than blasting the whole open backlog.
    const watchers: KeyedWatcher[] = webhook
      ? [
          startKeyedWatcher({
            projects,
            build: items => buildInterventions(items, { dashboardUrl: deps.dashboardUrl }),
            keyOf: interventionKey,
            onNew: async items => {
              if (!discordNotificationEnabled(await prefs(), 'notifyHumanIntervention')) return
              const delivered = await postInterventionsDiscord(webhook, items).catch(() => false)
              if (!delivered) log('[framework] could not post a needs-you batch to the Discord webhook')
            },
          }),
          startKeyedWatcher({
            projects,
            build: buildActivity,
            keyOf: activityKey,
            onNew: async items => {
              if (!discordNotificationEnabled(await prefs(), 'notifyNewActivity')) return
              const delivered = await postActivityDiscord(webhook, items).catch(() => false)
              if (!delivered) log('[framework] could not post an activity batch to the Discord webhook')
            },
          }),
        ]
      : []

    // Send a session's answers back to the channel that asked (#932). The committed conversation
    // (#908) is the source: it holds the settled reply the user would have read, which is what
    // belongs in chat. Bound per run by the bot, since the channel is only known when a message
    // arrives.
    const replyMirror = botToken
      ? startDiscordReplyMirror({
          readConversation: async runId => {
            // A run's transcript lives in the checkout the run used, which for a daemon-spawned run
            // is its own worktree rather than the project root.
            const summaries = await projects()
            let listed = false
            for (const project of summaries) {
              const metas = await readLiveMetas(project.path).then(
                m => ((listed = true), m),
                (): LiveRun[] => [],
              )
              const meta = metas.find(run => run.id === runId)
              if (meta) return readConversation(meta.cwd, runId).catch(() => [])
            }
            // `undefined` = the listings worked and the run genuinely is not there (archived, or its
            // project removed); the mirror counts these and releases the binding, so per-poll IO
            // stops growing (#941). An empty/unreadable registry or all-failing meta reads is a
            // transient outage, not evidence the run is gone — `[]` keeps the binding alive.
            return summaries.length > 0 && listed ? undefined : []
          },
          post: (channelId, text) => postMessage(botToken, channelId, text),
          enabled: botEnabled,
          // The discord modules do not prefix their own lines, so the daemon does it for them.
          onLog: message => log(`[framework] ${message}`),
        })
      : undefined

    // The Discord chatbot (#680). Two gates like the watchers above: a bot token (a bot can read
    // replies; the #627 webhook cannot) and the per-user `discordBot` preference, read per message
    // so the toggle takes effect without a restart. No token means no bot.
    const bot = botToken
      ? startDiscordBot({
          token: botToken,
          target: async () => {
            const home = (await projects()).find(p => p.id === homeId)
            return home ? { id: home.id, name: home.name } : { id: homeId, name: basename(deps.cwd) }
          },
          liveRun: async id => snapshotLiveRun(id, await projectPath(id)),
          // `via` so the opening turn is filed under Discord too (#917): without it a chat-started
          // session reads as if its first message came from the dashboard and only the follow-ups
          // came from Discord, which is a worse record than attributing none of it.
          start: async (id, text) => {
            const result = await startUnattended(id, text, { via: DISCORD_VIA })
            return result.ok ? result.runId : undefined
          },
          sendMessage: (id, text, runId) => sendMessage(id, text, runId, DISCORD_VIA),
          sendChoice: (id, gateId, pick, runId) => sendChoice(id, gateId, pick, 'user', runId),
          sendStop,
          ...(replyMirror ? { onRunBound: (runId, channelId) => replyMirror.bind(runId, channelId) } : {}),
          enabled: botEnabled,
          ...(env.DISCORD_CHANNEL_ID ? { channelId: env.DISCORD_CHANNEL_ID } : {}),
          onLog: message => log(`[framework] ${message}`),
        })
      : undefined

    // Say so when the token is set but the toggle is not: the bot would otherwise connect and then
    // ignore every message, which reads as broken rather than as off.
    if (botToken) {
      void botEnabled().then(on => {
        if (!on) log('[framework] Discord bot: the token is set but the `discordBot` preference is off, so it will not answer.')
      })
    }

    return () => {
      // The bot's gateway socket is the one connection here that would otherwise hold the event
      // loop open on its own.
      bot?.stop()
      replyMirror?.stop()
      for (const watcher of watchers) watcher.stop()
    }
  }

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

  return {
    quiesce: () => {
      stopped = true
      stopDiscord()
      autoPm.stop()
      // The CI watch can start fix runs, so it stops with the other run-starters.
      ciWatch.stop()
      mergedWorktrees.stop()
      // Stop the timer here, so `flushConversations` below is a single flush past the idle window
      // rather than a wait for a poll that is no longer coming.
      conversationCommitter.stop()
    },
    flushConversations: () => conversationCommitter.flush().catch(() => 0),
    reloadDiscord,
    // Awaitable (#1433) so the trigger button can wait for the sweep's answer; a caller that
    // does not care simply drops the promise. The plain wake is safe to call when the preference
    // went the other way — the sweep re-reads the box, records "off", and starts nothing — while
    // an on-demand one (#1210) runs regardless, because the click is the ask.
    wakeAutoPm: opts => autoPm.tick(opts).catch(() => {}),
    autoPmReport: () => autoPm.report(),
  }
}

/**
 * Resume what the last daemon suspended (#923).
 *
 * A run does not outlive its daemon: it is stopped at shutdown and its id + agent session recorded,
 * so a restart continues the same conversation in the same worktree instead of leaving an orphan
 * behind. The state survives the process, which is the #857 direction; the process does not.
 *
 * Capped by age so a machine that has been off for a week does not wake up spending a day's quota
 * on stale work, and the record is cleared as it is read, so a run that fails to resume is not
 * retried on every boot.
 */
export async function resumeSuspendedRuns(
  env: NodeJS.ProcessEnv,
  startRun: BackgroundServiceDeps['startRun'],
  log: (message: string) => void,
): Promise<void> {
  for (const record of await listProjects(undefined, env).catch(() => [])) {
    const suspended = await readSuspendedRuns(record.path).catch(() => [])
    if (suspended.length === 0) continue
    await writeSuspendedRuns(record.path, []).catch(() => {})
    const resumable = resumableRuns(suspended, Date.now())
    const dropped = suspended.length - resumable.length
    const where = basename(record.path)
    if (dropped > 0) log(`[framework] ${dropped} suspended session(s) in ${where} are too old to resume`)
    for (const run of resumable) {
      const options = await resolveProjectRunOptions(record.id, env)
      const result = await startRun(
        RESUME_PROMPT,
        {
          ...options,
          unattended: true,
          continueRunId: run.runId,
          ...(run.sessionId ? { resumeSession: run.sessionId } : {}),
          // Hand the drain's pin back (#1268): the resumed process re-emits the queue-entry
          // event, so the claim reaches the rebuilt meta whether or not the replay kept it.
          ...(run.queueEntry ? { queueEntry: run.queueEntry } : {}),
        },
        record.id,
      )
      log(
        result.ok
          ? `[framework] resumed session ${run.runId} in ${where}`
          : `[framework] could not resume session ${run.runId}: ${result.error}`,
      )
    }
  }
}

/**
 * What a resumed run is asked to do (#923). The agent comes back with its own session, so it has
 * the whole conversation: the only thing it is missing is why it suddenly stopped mid-task.
 */
export const RESUME_PROMPT =
  'This session was interrupted when The Framework restarted, not by anyone asking you to stop. Look at what you had already done, then carry on from there. ' +
  'The session lifecycle still applies: once the work is genuinely finished with nothing left to do, call setReadyForMerge() — without it the finished work is never merged.'
