import { basename, join, resolve } from 'node:path'
import { listProjects, projectId, readPreferences, readSecrets, type Preferences } from './registry.js'
import { resolveDiscordCredentials, type DiscordCredentials } from './discord-credentials.js'
import { errorMessage } from './error-message.js'
import { notifies, notifyCategoryEnabled } from './preference-defaults.js'
import { agentOptionsFromPreferences, preferencesFromFileConfig } from './agent-options.js'
import { loadFrameworkConfig } from './config.js'
import { readLiveMetas, type LiveAgent } from './store/index.js'
import { startKeyedWatcher, type KeyedWatcher } from './dashboard/keyed-watcher.js'
import { buildInterventions, interventionKey, postInterventionsDiscord } from './dashboard/interventions.js'
import { buildActivity, activityKey, postActivityDiscord } from './dashboard/activity.js'
import { quotaHeadroom } from './quota-boundary.js'
import type { ActiveAgentSlot } from './daemon-runtime.js'
import { startDaemonTick, DAEMON_TICK_MS } from './daemon-tick.js'
import { ciFixPrompt, startCiWatch } from './ci-watch.js'
import { DATA_BRANCH, pullFileBranch } from '@gemstack/agent-data'
import type { ProjectErrors } from './project-errors.js'
import { readFile, writeFile } from 'node:fs/promises'
import { startMergedWorktreeSweep, type MergedSweepOptions } from './merged-worktrees.js'
import { reconcileBranchLinks } from '@gemstack/skill-branches'
import { startProjectPass } from './project-pass.js'
import { startCloudScratchSweep } from './cloud-scratch-refs.js'
import { adoptCloudWork, startCloudWorkAdoption } from './cloud-work.js'
import { resolveAgentPr } from './dashboard/agent-handoff.js'
import { sendChoice, sendMessage, sendStop } from './dashboard-rpc/control.js'
import type { ProjectSummary } from './dashboard/projects.js'
import type { QuotaSource } from './dashboard/quota.js'
import type { StartAgentOptions, StartAgentResult } from './dashboard/types.js'

/**
 * Everything the daemon runs in the background beside serving the dashboard: the two Discord
 * notification watchers (#627), the CI watch (#1418), the data sync (#1599), the worktree sweep
 * (#1036), the cloud-scratch sweep (#1547) and the cloud work adoption (#1601).
 *
 * All of it used to sit inline in `runDaemon`, which meant its body was a lifecycle narrative with
 * ~200 lines of service wiring in the middle of it. Each of these is gated the same way (an env
 * var says *where*, a preference says *whether*), and each reads its preference per tick so a
 * header toggle takes effect without a restart — so they belong together, and the daemon body is
 * left with the sequence it actually owns.
 *
 * They share one clock (E4). Each used to own a `setInterval`, so six intervals ran side by side
 * with no single place to look when a sweep was not running; now each declares how many ticks it
 * wants between turns and `daemon-tick.ts` fires them.
 */

/** Ticks between worktree sweeps, branch-link passes and cloud work adoption: ten-minute jobs. */
const TEN_MINUTES_EVERY = Math.round((10 * 60 * 1000) / DAEMON_TICK_MS)

/**
 * Ticks between cloud-scratch sweeps (#1547): hourly. The refs it deletes have to sit for a day
 * first, so a finer cadence would only spend `ls-remote` round-trips asking the same question.
 */
const CLOUD_SCRATCH_EVERY = Math.round((60 * 60 * 1000) / DAEMON_TICK_MS)

/** What the daemon needs back: the two shutdown phases, in the order the daemon's teardown needs them. */
export interface BackgroundServices {
  /**
   * Stop everything that could start or steer an agent, before the daemon suspends the agents it owns.
   * Ordered first on purpose: a CI fix starting mid-shutdown would otherwise start an agent while
   * we are busy stopping them.
   *
   * Resolves once the tick in flight has finished, so the sweeps are off the repo before the agents
   * are torn down — these jobs commit and push, and stopping their clock does not stop their turn.
   */
  quiesce: () => Promise<void>
  /**
   * Rebuild the Discord services against freshly-read credentials (#1095), so a token pasted into
   * the dashboard takes effect now rather than at the next daemon start. Idempotent and safe to
   * call when nothing changed: the watchers re-seed their baseline on the first poll, so a restart
   * never replays the open backlog as new notifications.
   */
  reloadDiscord: () => Promise<void>
}

/** What {@link startBackgroundServices} needs from the daemon. */
export interface BackgroundServiceDeps {
  /** The daemon's home workspace. Chat has no project picker, so a message with no run starts one here. */
  cwd: string
  env: NodeJS.ProcessEnv
  /** The dashboard's own URL, so a paused-agent item (#636) can link back to it. */
  dashboardUrl: string
  /** The long-lived quota meter the usage panel draws; the CI watch's fix gates on the same reading. */
  quota: QuotaSource
  /** Start an agent in a project. */
  startAgent: (prompt: string, options: StartAgentOptions, projectId: string) => Promise<StartAgentResult>
  /** The slots held on a project (#1646), so a background job can tell idle from busy, and say by what. */
  activeAgentSlots: (projectId: string) => readonly ActiveAgentSlot[]
  /**
   * The agents this daemon is still responsible for, whose checkouts the worktree sweep must leave
   * alone. See {@link MergedSweepOptions.busy}.
   */
  busyAgentIds: () => ReadonlySet<string>
  /** Where a job records a project state the user must fix (#1500), for the dashboard to show. */
  projectErrors: ProjectErrors
  log: (message: string) => void
}

/**
 * One project's data-sync turn (#1599): converge the `agent-data` branch — the skills' branch,
 * which carries the tickets, the queue and the `logs` skill's runs — with
 * origin through the shared branch library, one pull, and set or clear the project's `data-sync`
 * error by the outcome. The clear is unconditional on success, so the error lives exactly as long
 * as the condition — the next tick after the user fixes the remote, it is gone. The daemon knows
 * nothing of what is on the branch (#1774): a skill's own setup makes its files.
 */
export async function syncProjectData(path: string, errors: ProjectErrors, log: (message: string) => void): Promise<void> {
  const result = await pullFileBranch(path, DATA_BRANCH, { log })
  if (result.ok) errors.clear(path, 'data-sync')
  else {
    log(`[framework] data sync: ${result.error}`)
    errors.set(path, 'data-sync', result.error)
  }
}

/** The registered projects as dashboard summaries. */
async function listSummaries(env: NodeJS.ProcessEnv): Promise<ProjectSummary[]> {
  const records = await listProjects(undefined, env).catch(() => [])
  return records.map(p => ({ id: p.id, path: p.path, name: basename(p.path), activated: true }))
}

/** The user's preferences, or empty when they cannot be read — the defaults are what an agent would use anyway. */
function readPrefs(env: NodeJS.ProcessEnv): Promise<Preferences> {
  return readPreferences(undefined, env).catch(() => ({}) as Preferences)
}

/**
 * The agent options a project's settings imply (#858): the user's global tier, then the repo's
 * committed `the-framework.yml` (#842) on top. The same mapping and the same two tiers the launcher
 * uses, so an agent started by the daemon and an agent started by hand differ only in who asked for it.
 * An unreadable tier falls back to empty rather than failing the start: the defaults are what the
 * run would have used anyway.
 *
 * Exported for the daemon's continuation starts (#1467): a dashboard Resume sends only its seed
 * (`resumeSession` + `continueAgentId`), so these are the base its options overlay.
 */
export async function resolveProjectAgentOptions(id: string, env: NodeJS.ProcessEnv): Promise<StartAgentOptions> {
  const global = await readPrefs(env)
  const path = (await listProjects(undefined, env).catch(() => [])).find(p => p.id === id)?.path
  const file = path ? await loadFrameworkConfig(path).catch(() => ({})) : {}
  return agentOptionsFromPreferences({ ...global, ...preferencesFromFileConfig(file) })
}

/**
 * A held slot as the sweep's lines say it (#1646): the run's id with its pid, so the reader can
 * go from a stand-down straight to `ps` and to the run's own page. The worktree-less fallback
 * agent has no id of its own and is named by where it runs.
 */
function describeSlot(slot: ActiveAgentSlot): string {
  const who = slot.agentId ?? 'a run in the project checkout'
  return slot.state === 'starting' ? `${who} (starting)` : `${who} (pid ${slot.pid})`
}

export function startBackgroundServices(deps: BackgroundServiceDeps): BackgroundServices {
  const { env, log } = deps
  const projects = () => listSummaries(env)
  const prefs = () => readPrefs(env)

  /**
   * Start an agent nobody is watching. `unattended` is forced on top of the project's settings rather
   * than read from them: it is a property of there being no human at the keyboard, not a
   * preference, and without it every choice gate parks forever on an answer that is not coming
   * (#846).
   */
  const startUnattended = async (projectId: string, prompt: string, extra: StartAgentOptions = {}) => {
    const options = await resolveProjectAgentOptions(projectId, env)
    return deps.startAgent(prompt, { ...options, ...extra, unattended: true }, projectId)
  }

  /**
   * Where the account stands against the boundary for the run {@link startUnattended} would make
   * on this project (#1619) — the same resolve, asked for the model rather than for the options.
   * A gate that measured a different model than the one about to run would clear a window that
   * is already spent, and the run would die at its first API call.
   */
  const quotaFor = async (projectId: string) =>
    deps.quota.boundaryFor((await resolveProjectAgentOptions(projectId, env)).model)

  // The stand-downs the fix half has already said, keyed `<cwd>\0<number>\0<headSha>` like the
  // CI sweep's own attempted-merge set: in memory, so a restart says it once more.
  const quotaSaid = new Set<string>()

  // Watch the PRs the framework is waiting to land (#1418): merge a `watched` PR once its checks
  // pass (the #1417/#1406 answer for repos without GitHub auto-merge), and put an agent on a
  // watched PR whose checks fail. The merge half runs ungated — it finishes a merge the agent was
  // already armed and authorized for. The fix half starts runs on its own, so it takes consent
  // first: the `autoPm` preference (read per attempt, like every other per-tick gate here) and
  // quota headroom.
  const ciWatch = startCiWatch({
    projects,
    log,
    deps: {
      fix: async (cwd, request) => {
        if ((await prefs()).autoPm !== true) return undefined
        const project = (await projects()).find(p => p.path === cwd)
        if (!project) return undefined
        // Resolved before the meter is read, because the model the fix would run on is what the
        // meter has to be measured against (#1619).
        const headroom = quotaHeadroom(await quotaFor(project.id).catch(() => undefined))
        if (!headroom.start) {
          // Said once per failing head, the same re-arm rule the fix half's own restraint uses
          // (#1418): a stand-down that repeated every tick would drown the log for as long as the
          // PR stayed red, and one that said nothing at all is what made this invisible (#1619).
          const key = `${cwd}\0${request.number}\0${request.headSha}`
          if (!quotaSaid.has(key)) {
            quotaSaid.add(key)
            log(`[framework] CI watch: not starting a fix for PR #${request.number} — ${headroom.reason}`)
          }
          return undefined
        }
        // The fix lands on the red PR's own branch, so this agent's handoff must not push or open
        // anything of its own.
        const result = await startUnattended(project.id, ciFixPrompt(request), { handoff: 'local' })
        return result.ok ? result.agentId : undefined
      },
    },
  })

  // Reclaim the checkout of a session whose work is on the remote (#1036/E5): the branch and the
  // session's row are kept, so this frees disk rather than throwing work away. It is the retry for
  // a push that could not land at teardown.
  const mergedWorktrees = startMergedWorktreeSweep({ projects, log, busy: deps.busyAgentIds })

  // The #1580 branches view: one symlink per worktree under `.branches/`, named as its branch.
  // Quiet, idempotent, near-free per tick.
  // The branches view (#1580): links settle within a tick, and allocation reconciles its own
  // checkout immediately. Quiet on purpose — links are presentation.
  const branchLinks = startProjectPass(projects, cwd => reconcileBranchLinks(cwd).catch(() => {}))

  // Delete the scratch refs a web hand-off leaves on origin (#1547): the pre-hand-off `cloud-*`
  // ref and the run branch, one dead pair per web run. Daemon-side rather than in the driver,
  // because session creation only signals "created", not "clone finished" — a driver deleting its
  // own ref races the provisioning and can strand the session. The sweep waits out that race
  // (~a day) and only deletes refs whose work is provably on the default branch.
  const cloudScratch = startCloudScratchSweep({ projects, log, busy: deps.busyAgentIds })

  // Adopt the branch a cloud session actually worked on (#1601): match each settled web run to
  // the `claude/*` head descending from its hand-off anchor, record the branch and PR on the
  // run's archive, and open the armed draft PR the session never did. Daemon-side by necessity:
  // the branch does not exist yet when the wrapper ends — the cloud VM is still provisioning.
  const cloudWork = startCloudWorkAdoption({ projects, log, adopt: cwd => adoptCloudWork(cwd) })

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
            scopeOf: item => item.projectId,
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
            scopeOf: item => item.projectId,
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
    // worktree sweep goes first, so its start-up turn lands while the daemon owns no agents at all.
    // Behind a slow job it would instead land in the middle of the first session, racing that
    // session's teardown for the same checkout — which the `busy` guard then has to catch.
    jobs: [
      // Ten minutes. Its start-up turn is the point: the case it exists for is a machine that was
      // off (or a daemon that was down) while a session's push could not land.
      { name: 'worktree sweep', every: TEN_MINUTES_EVERY, run: () => mergedWorktrees.tick() },
      // After the worktree sweep, so links to checkouts the sweep just reclaimed drop in the same
      // turn. A rename settles within a tick; a fresh worktree gets its link at allocation.
      { name: 'branch links', every: TEN_MINUTES_EVERY, run: () => branchLinks.tick() },
      // The eager data pull (#1582): converge every project's data checkout on what other
      // machines and cloud sessions pushed, and carry out anything a failed cycle left local.
      // Its start-up turn is also what creates the checkout on a fresh clone. A project that
      // cannot converge is recorded as such for the dashboard (#1599).
      {
        name: 'data sync',
        every: 2,
        run: async () => {
          for (const project of await projects().catch((): ProjectSummary[] => []))
            await syncProjectData(project.path, deps.projectErrors, log)
        },
      },
      // ~1 min, the CI latency agreed on #1418.
      { name: 'CI watch', every: 2, run: () => ciWatch.tick() },
      // The watched things change slowly and a poll costs a read per project. Their first turn is
      // the baseline seed, which must happen at start-up or the whole open backlog reads as new.
      { name: 'Discord watchers', every: 2, run: async () => { for (const w of discordWatchers) await w.poll() } },
      // Hourly. Its start-up turn is what starts a `cloud-*` ref's one-day clock (#1547): the
      // sweep ages those refs from when it first saw them, so the sooner it looks, the sooner
      // a leftover can go.
      { name: 'cloud scratch sweep', every: CLOUD_SCRATCH_EVERY, run: () => cloudScratch.tick() },
      // Ten minutes: the cloud session it waits on lives minutes-to-hours itself, and the pass
      // costs an `ls-remote` per project only while a settled web run is actually waiting.
      { name: 'cloud work adoption', every: TEN_MINUTES_EVERY, run: () => cloudWork.tick() },
    ],
  })

  return {
    quiesce: async () => {
      stopped = true
      await clock.stop()
      stopDiscord()
      // The CI watch can start fix runs, so it stops with the other run-starters.
      ciWatch.stop()
      mergedWorktrees.stop()
      branchLinks.stop()
      cloudScratch.stop()
      cloudWork.stop()
    },
    reloadDiscord,
  }
}

