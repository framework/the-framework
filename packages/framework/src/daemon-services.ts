import { basename } from 'node:path'
import { listProjects, readPreferences, readSecrets, type Preferences } from './registry.js'
import { resolveDiscordCredentials, type DiscordCredentials } from './discord-credentials.js'
import { errorMessage } from './error-message.js'
import { notifies } from './preference-defaults.js'
import { startKeyedWatcher, type KeyedWatcher } from './dashboard/keyed-watcher.js'
import { buildInterventions, interventionKey, postInterventionsDiscord } from './dashboard/interventions.js'
import { buildActivity, activityKey, postActivityDiscord } from './dashboard/activity.js'
import { startDaemonTick, DAEMON_TICK_MS } from './daemon-tick.js'
import { DATA_BRANCH, pullFileBranch } from '@gemstack/agent-data'
import type { ProjectErrors } from './project-errors.js'
import { startCloudScratchSweep } from './cloud-scratch-refs.js'
import { adoptCloudWork, startCloudWorkAdoption } from './cloud-work.js'
import type { ProjectSummary } from './dashboard/projects.js'
import { providerProblems } from './store/provided.js'

/**
 * Everything the daemon runs in the background beside serving the dashboard: the two Discord
 * notification watchers (#627), the data sync (#1599), the cloud-scratch sweep (#1547) and the
 * cloud work adoption (#1601). None of them starts a run (#1774).
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

/** Ticks between cloud work adoption passes: a ten-minute job. */
const TEN_MINUTES_EVERY = Math.round((10 * 60 * 1000) / DAEMON_TICK_MS)

/**
 * Ticks between cloud-scratch sweeps (#1547): hourly. The refs it deletes have to sit for a day
 * first, so a finer cadence would only spend `ls-remote` round-trips asking the same question.
 */
const CLOUD_SCRATCH_EVERY = Math.round((60 * 60 * 1000) / DAEMON_TICK_MS)

/** What the daemon needs back. */
export interface BackgroundServices {
  /**
   * Stop every background job. Resolves once the tick in flight has finished: these jobs commit
   * and push, and stopping their clock does not stop their turn.
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
  env: NodeJS.ProcessEnv
  /** The dashboard's own URL, so a paused-agent item (#636) can link back to it. */
  dashboardUrl: string
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

/**
 * One project's provider check (#1820), on the data sync's clock: a kind of the project's data
 * that packages declare but none is settled to provide (several declare it and the project's
 * package.json names none, or names one that does not declare it) is the project's `provider`
 * error, every such kind on its own line; every kind settled clears it. The framework never picks
 * the first declarer silently: the project says, or nothing provides and the banner says why.
 */
export async function checkProviders(path: string, errors: ProjectErrors): Promise<void> {
  const problems = await providerProblems(path)
  if (problems.length === 0) errors.clear(path, 'provider')
  else errors.set(path, 'provider', problems.join('\n'))
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

export function startBackgroundServices(deps: BackgroundServiceDeps): BackgroundServices {
  const { env, log } = deps
  const projects = () => listSummaries(env)
  const prefs = () => readPrefs(env)

  // Delete the scratch refs a web hand-off leaves on origin (#1547): the pre-hand-off `cloud-*`
  // ref and the run branch, one dead pair per web run. Daemon-side rather than in the driver,
  // because session creation only signals "created", not "clone finished" — a driver deleting its
  // own ref races the provisioning and can strand the session. The sweep waits out that race
  // (~a day) and only deletes refs whose work is provably on the default branch.
  const cloudScratch = startCloudScratchSweep({ projects, log })

  // Adopt the branch a cloud session actually worked on (#1601): match each settled web run to
  // the `claude/*` head descending from its hand-off anchor, record the branch and PR on the
  // run's archive, and open the armed draft PR the session never did. Daemon-side by necessity:
  // the branch does not exist yet when the wrapper ends — the cloud VM is still provisioning.
  const cloudWork = startCloudWorkAdoption({ projects, log, adopt: cwd => adoptCloudWork(cwd) })

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
    jobs: [
      // The eager data pull (#1582): converge every project's data checkout on what other
      // machines and cloud sessions pushed, and carry out anything a failed cycle left local.
      // Its start-up turn is also what creates the checkout on a fresh clone. A project that
      // cannot converge is recorded as such for the dashboard (#1599).
      {
        name: 'data sync',
        every: 2,
        run: async () => {
          for (const project of await projects().catch((): ProjectSummary[] => [])) {
            await syncProjectData(project.path, deps.projectErrors, log)
            await checkProviders(project.path, deps.projectErrors)
          }
        },
      },
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
      cloudScratch.stop()
      cloudWork.stop()
    },
    reloadDiscord,
  }
}

