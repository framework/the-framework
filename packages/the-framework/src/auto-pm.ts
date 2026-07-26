import type { QuotaBoundaryStatus } from './quota-boundary.js'
import { presets } from './preset-catalog.js'

/**
 * Auto PM (#685): spend leftover subscription quota on product management instead of
 * letting it expire. While the account is still under its quota boundary (#879) and nobody
 * is at the keyboard, the daemon runs the cycle by itself: it works the agent queue down entry by entry (#855),
 * and once that is empty it refills it — triaging tickets, then spiking and planning
 * the ones that have neither yet.
 *
 * The whole feature is one policy question ("is now a good time to spend tokens on our
 * own roadmap?"), so that question lives here as a pure function and the daemon only
 * supplies the readings. #298 is the parent idea (background jobs / "max out the usage"),
 * and #879 defines the boundary this reads.
 */

/** How often the daemon re-asks {@link autoPmDecision}. */
export const DEFAULT_AUTO_PM_INTERVAL_MS = 10 * 60 * 1000

/**
 * How long a project is left alone after an auto run is started for it. A spawned run
 * takes a moment to appear in the daemon's live-run map, and without this the next tick
 * would see "nothing running, queue still empty" and start a second one.
 */
export const DEFAULT_AUTO_PM_COOLDOWN_MS = 30 * 60 * 1000

/** What the policy was told about one project at one moment. */
export interface AutoPmInputs {
  /** The `autoPm` preference. Off = the feature does nothing at all. */
  enabled: boolean
  /**
   * Whether the project's agent queue (`TODO_AGENTS.md`) has no open entry left, or `undefined`
   * when it could not be read. Unreadable is not empty and not full: it fails closed, because
   * since #855 both answers now *start* something and only "we could not tell" does not.
   */
  backlogEmpty: boolean | undefined
  /** Live runs on this project. Any run at all means the user's quota is already being spent. */
  activeRuns: number
  /** Where the account stands against its quota boundary, or `undefined` when it could not be read. */
  quota: QuotaBoundaryStatus | undefined
  /** Milliseconds since this project was last auto-started, or `undefined` if it never was. */
  sinceLastStartMs?: number
  /** Override {@link DEFAULT_AUTO_PM_COOLDOWN_MS}. */
  cooldownMs?: number
}

/** Why the sweep is not starting anything. Logged, so it reads as a sentence. */
export type AutoPmRefusal = { start: false; reason: string }

/**
 * Which half of the cycle a start belongs to (#855). `drain` works an entry the queue already
 * holds; `pm` puts new work in it. The queue decides: standing work is spent before more is made.
 */
export type AutoPmMode = 'drain' | 'pm'

/** Whether the budget allows spending unasked at all, before asking what to spend it on. */
export type QuotaDecision = { start: true } | AutoPmRefusal

/** Start (and at what), or the reason not to. */
export type AutoPmDecision = { start: true; mode: AutoPmMode } | AutoPmRefusal

/**
 * Whether the budget allows spending unasked.
 *
 * The gate is the quota boundary (#879): the pro-rated share of the week's allowance elapsed so
 * far, rising continuously with the clock (#960 Edit), so auto PM spends up to that line and
 * stands down at it. Work the user asks for is free to cross it and borrow against the days still
 * to come; work nobody asked for is exactly what the line is there to stop.
 *
 * **It fails closed on a quota it cannot read, and that is the opposite of the per-run guard.**
 * #519 settled that an unreadable quota must never *stop* the user's own work, so
 * `startConsumptionGuard` fails open. Quietly burning a subscription on work nobody asked for
 * is a far worse failure than skipping a tick.
 *
 * Reading the account's own week also means a restarted daemon is not blind: the figure is
 * absolute and complete, unlike the delta meter this replaced, which reported zero consumed
 * after a restart however much the account had spent (#848).
 */
export function quotaHeadroom(quota: QuotaBoundaryStatus | undefined): QuotaDecision {
  if (!quota) return { start: false, reason: 'the quota could not be read, so there is no way to tell what is spare' }
  const reached = quota.reached
  if (reached) {
    // Name the line it actually stopped at (#960). With the slider moved, saying "the week's 43%"
    // when the run stopped at 63% would send someone looking for a bug that is a setting.
    // The offset is rounded to one decimal for the sentence: a dragged slider stores integers,
    // but the half-day default (#960 Edit) is 100/14 and fifteen digits of it would say less.
    const { limit, boundary } = quota
    const offsetText = `${limit.offset > 0 ? '+' : ''}${Math.round(limit.offset * 10) / 10}`
    const line = limit.offset === 0
      ? `the week's ${Math.round(boundary.percent)}%`
      : `your ${Math.round(limit.percent)}% limit (${offsetText} on the week's ${Math.round(boundary.percent)}%)`
    return {
      start: false,
      reason: `${reached.label} is ${Math.round(reached.percentUsed)}% used, at or past day ${boundary.day} of ${line}`,
    }
  }
  return { start: true }
}

/**
 * Whether to start a PM run for one project right now. Every condition is a reason to
 * *not* spend the user's quota, checked cheapest first so the common "someone is working"
 * case never reaches the meter.
 */
export function autoPmDecision(input: AutoPmInputs): AutoPmDecision {
  if (!input.enabled) return { start: false, reason: 'auto PM is off' }
  if (input.activeRuns > 0) {
    return { start: false, reason: `${input.activeRuns} run${input.activeRuns === 1 ? ' is' : 's are'} already going` }
  }
  const cooldownMs = input.cooldownMs ?? DEFAULT_AUTO_PM_COOLDOWN_MS
  if (input.sinceLastStartMs !== undefined && input.sinceLastStartMs < cooldownMs) {
    return { start: false, reason: 'a run was started for this project a moment ago' }
  }
  if (input.backlogEmpty === undefined) {
    return { start: false, reason: 'the agent queue could not be read, so there is no way to tell what to do' }
  }
  const headroom = quotaHeadroom(input.quota)
  if (!headroom.start) return headroom
  // The queue picks the job, and a non-empty one wins (#855). It used to be a refusal, on the
  // reasoning that the backlog loop would drain it — but that loop only exists inside a run a
  // human started, so unattended the queue filled once and nothing ever emptied it again.
  return { start: true, mode: input.backlogEmpty ? 'pm' : 'drain' }
}

/**
 * One thing auto PM knows how to do while the machine is idle (#773).
 *
 * The jobs form a cycle, and the order matters: triage turns tickets into queued work, [Spike &
 * plan] turns the rest into plans. Once a job queues something the sweep switches to draining it
 * (#855), and the rotation resumes where it left off once the queue is empty again.
 */
export interface AutoPmJob {
  /** Stable id: the rotation and the opt-out list (#1209) key on it. */
  name: string
  /** The prompt to run, verbatim. */
  prompt: string
  /**
   * A line saying what the job does, wherever its {@link label} does not already: under the label
   * in the routines list, and as the log line's wording. Only the maintenance sweep carries one --
   * "Maintenance" names its preset rather than the work -- while the other routines' labels read
   * as what they do, so their rows stay one line and their log lines say the label itself rather
   * than the same thing twice. Data on the job rather than a name matched in the dashboard, so a
   * rename cannot quietly move the line around.
   */
  describe?: string
  /**
   * The user-facing name, for a surface that lists the routines (#1159). Read off the preset the
   * job fires rather than written again here, so a relabelled preset relabels its routine.
   */
  label?: string
  /**
   * This job works an entry already on the queue, rather than putting entries on it (#1117).
   *
   * Only the draining job has a specific piece of work it is about to pick up, so only it can be
   * told which ticket that is. Declared here rather than matched on {@link AutoPmJob.name} at the
   * call site, so the job says what it does and a rename cannot quietly unhook it.
   */
  drains?: boolean
}

/**
 * The default cycle, ordered cheapest-and-readiest first: triage the quick tickets (#891), then
 * the significant-but-agreed ones (#892), and only then make more plans (#685). Planning is the
 * most expensive turn and the one whose output the earlier jobs consume, so it runs last.
 *
 * This rotation is what #891/#892 mean by "with a cron job regularly firing this preset". No
 * separate scheduler is involved and none is needed: the rotation already fires on every idle tick
 * where the queue is dry, which is exactly when the queue wants refilling. That is the opposite of
 * the maintenance sweep (#882), which is paced by a calendar because it looks at static history and
 * would otherwise never come due — hence its own {@link AUTO_PM_MAINTENANCE_JOB} outside the cycle.
 *
 * The gated triage sibling (#698) is deliberately not here: it ends in `<AWAIT>`, so firing it with
 * nobody at the keyboard would park a run against a human who will never answer.
 *
 * Each triage prompt pins its own session name and aborts if that branch already exists, so a
 * rotation that comes round again while the previous triage is still in flight is a no-op rather
 * than a duplicate. The rotation still advances past it, which is the wanted behaviour: the next
 * idle tick tries the next job instead of retrying a job that is already running.
 */
export const AUTO_PM_JOBS: readonly AutoPmJob[] = [
  {
    name: presets.triageQuick.name,
    prompt: presets.triageQuick.render(),
    label: presets.triageQuick.label,
  },
  {
    name: presets.triageConsensual.name,
    prompt: presets.triageConsensual.render(),
    label: presets.triageConsensual.label,
  },
  {
    name: presets.spikeAndPlan.name,
    prompt: presets.spikeAndPlan.render(),
    label: presets.spikeAndPlan.label,
  },
]

/**
 * The job for a queue that is not empty (#855): work its first entry off. Outside the rotation
 * on purpose — the rotation is about what to *make* when there is nothing to do, and this is
 * the thing to do.
 */
export const AUTO_PM_DRAIN_JOB: AutoPmJob = {
  name: presets.drainQueue.name,
  prompt: presets.drainQueue.render(),
  label: presets.drainQueue.label,
  drains: true,
}

/**
 * The periodic codebase-wide sweep (#882): fire the [Maintenance] preset (#881) so a repo that
 * adopted The Framework late gets its pre-existing history looked at.
 *
 * Outside the rotation, like {@link AUTO_PM_DRAIN_JOB} and for the same kind of reason: the
 * rotation is "what to make next" and cycles every idle tick, while this is paced by a calendar
 * and must not advance or be advanced by the cycle. It takes precedence over the rotation when
 * due, because the entries it queues are what the rotation would otherwise be inventing work
 * instead of.
 *
 * The prompt renders at module load with no session, so `tf.params.what` falls back to its
 * default of the entire codebase, which is exactly this job's scope.
 */
export const AUTO_PM_MAINTENANCE_JOB: AutoPmJob = {
  name: presets.maintenance.name,
  prompt: presets.maintenance.render(),
  describe: 'sweeping the codebase for maintenance work',
  label: presets.maintenance.label,
}

/**
 * Every routine the sweep can fire, in the order a surface should list them (#1159).
 *
 * Derived from the three constants above rather than written out again, so the list the dashboard
 * shows and the jobs the daemon actually runs cannot drift. The order is the sweep's own precedence
 * (#855/#882 read the other way round): draining comes first because it is what happens whenever
 * there is queued work, the rotation is what happens when there is not, and the calendar-paced
 * maintenance sweep is the exception outside both.
 */
export const AUTO_PM_ROUTINES: readonly AutoPmJob[] = [
  AUTO_PM_DRAIN_JOB,
  ...AUTO_PM_JOBS,
  AUTO_PM_MAINTENANCE_JOB,
]

/** The sentence a start is reported as: the log line and the outcome message say the same thing. */
const doing = (job: AutoPmJob) => job.describe ?? job.label ?? job.name

/**
 * What became of one attempt to land a run's queue (#852). The two flags are separate on purpose:
 * a finished run that wrote no queue is `settled` without being `promoted`, and must stop being
 * retried; a still-running one is neither, and is tried again next tick.
 */
export interface PromoteOutcome {
  /** Stop tracking this run: it is finished, whether or not it left anything behind. */
  settled: boolean
  /** The checkout's queue actually changed. */
  promoted: boolean
}

/** A project the sweep considers. */
export interface AutoPmProject {
  /** Registry id, as `start` and the live-run lookup take it. */
  id: string
  /** Absolute repo path, for reading its queue. */
  path: string
}

/** The readings and effects {@link startAutoPm} needs, injected so the loop is testable off disk. */
export interface AutoPmDeps {
  /** The projects to consider. */
  projects(): Promise<readonly AutoPmProject[]>
  /** The `autoPm` preference, re-read per tick so the toggle takes effect without a restart. */
  enabled(): Promise<boolean>
  /**
   * The routines the user has switched off, by {@link AutoPmJob.name} (#1209). Re-read per tick
   * for the same reason {@link AutoPmDeps.enabled} is, and an unreadable answer means none:
   * a preference that cannot be read must not silently switch the whole rotation off.
   */
  optedOut?(): Promise<readonly string[]>
  /** Whether a project's agent queue has run dry. */
  backlogEmpty(project: AutoPmProject): Promise<boolean>
  /** How many runs are live on a project. */
  activeRuns(project: AutoPmProject): number
  /** Where the account stands against its boundary, or `undefined` when there is no reading. */
  quota(): Promise<QuotaBoundaryStatus | undefined>
  /** The jobs to rotate through, in cycle order. Used only while the queue is empty. */
  jobs: readonly AutoPmJob[]
  /** The job for a queue with open entries (#855); {@link AUTO_PM_DRAIN_JOB} by default. */
  drainJob?: AutoPmJob
  /**
   * Whether a project is due its periodic codebase sweep (#882). Injected rather than computed
   * here because the schedule lives in a file in the project checkout, and this module is pure
   * policy. Omitted entirely (or throwing) means "not due", so a daemon that cannot read the
   * schedule keeps doing the rotation rather than sweeping on every tick.
   */
  maintenanceDue?(project: AutoPmProject): Promise<boolean>
  /** Stamp a project as swept, so the next sweep is an interval away. Paired with {@link AutoPmDeps.maintenanceDue}. */
  recordMaintenance?(project: AutoPmProject): Promise<void>
  /** The job fired when {@link AutoPmDeps.maintenanceDue} says yes; {@link AUTO_PM_MAINTENANCE_JOB} by default. */
  maintenanceJob?: AutoPmJob
  /** Start the PM run. Resolves the run's id, or undefined when the daemon refused. */
  start(project: AutoPmProject, job: AutoPmJob): Promise<string | undefined>
  /**
   * Land a finished run's queue in the project checkout (#852). Called before the sweep decides
   * anything: a run's queue lives on its own worktree branch, so until it is promoted the checkout
   * still reads empty and the sweep would start the same work over again.
   */
  promote(project: AutoPmProject, runId: string): Promise<PromoteOutcome>
  /** Progress line. */
  log(message: string): void
  /** Override the tick interval. */
  intervalMs?: number
  /** Override the per-project cooldown. */
  cooldownMs?: number
  /** Clock, injectable for tests. */
  now?: () => number
}

/** What the last sweep decided about one project. */
export interface AutoPmOutcome {
  /** Registry id of the project considered. */
  projectId: string
  /** Its path, which is what the log line names and the panel shows. */
  path: string
  /** Whether a run was started for it. */
  started: boolean
  /** The sentence: what was started, or the reason for standing down. */
  message: string
}

/**
 * What auto PM has done lately (#1161).
 *
 * Every decision was already logged (#855), but the log is the daemon's stdout and the toggle
 * lives in a browser, so from the dashboard a wedged sweep and a healthy idle one looked
 * identical — the same failure #855 fixed one layer down.
 */
export interface AutoPmReport {
  /** Whether the preference was on at the last sweep. `undefined` before the first one. */
  enabled?: boolean
  /** When the last sweep finished, epoch ms. `undefined` before the first one. */
  sweptAt?: number
  /** When the next sweep is due, epoch ms. */
  nextSweepAt: number
  /** One line per project the last sweep considered, in sweep order. */
  outcomes: AutoPmOutcome[]
}

/**
 * Where the dashboard reads {@link AutoPmReport} from. The daemon wires its live loop; a public
 * host (the relay) leaves it unset, and one that has not finished starting answers `undefined`.
 */
export type AutoPmReporter = () => AutoPmReport | undefined

/** A running sweep. */
export interface AutoPmLoop {
  /**
   * Run one sweep now, rather than waiting for the next tick. Called when the preference is
   * switched on (#1161) as well as from tests: the sweep re-reads it per tick, so without this
   * the box you just ticked does nothing at all for a whole interval.
   *
   * `onDemand` marks a sweep a person explicitly asked for (#1210's trigger button). The `autoPm`
   * preference is consent to spend quota *unasked*, and a click is asking — so an on-demand sweep
   * runs with the preference off, and the master switch is the only gate it skips: every other
   * reason to stand down (live runs, cooldowns, the quota boundary, unticked routines) still holds.
   */
  tick(opts?: { onDemand?: boolean }): Promise<void>
  /** What the last sweep decided, for the dashboard to show (#1161). */
  report(): AutoPmReport
  stop(): void
}

/**
 * Start the auto-PM sweep (#685): every {@link DEFAULT_AUTO_PM_INTERVAL_MS}, ask
 * {@link autoPmDecision} for each project and start a run for the ones that say yes.
 *
 * Ticks never overlap — a sweep reads a live-run map that its own `start` calls mutate,
 * so a second sweep running over the first would decide against a stale picture.
 *
 * Nothing here survives the daemon: per #519 a Ctrl+C that stops everything is the feature,
 * not a gap, so this loop is deliberately not restartable from outside the process.
 */
export function startAutoPm(deps: AutoPmDeps): AutoPmLoop {
  const now = deps.now ?? (() => Date.now())
  const intervalMs = deps.intervalMs ?? DEFAULT_AUTO_PM_INTERVAL_MS
  const startedAt = now()
  // What the last sweep decided, for `report()`. Undefined only in the moment before the
  // start-up sweep below lands.
  let lastSweep: { enabled: boolean; sweptAt: number; outcomes: AutoPmOutcome[] } | undefined
  const lastStart = new Map<string, number>()
  // Runs this loop started whose queue has not reached the checkout yet, oldest first.
  const pending = new Map<string, string[]>()
  // Where each project is in the job cycle. Per project, not global: two repos idle at once
  // should each work through the rotation, not take alternate halves of it.
  const nextJob = new Map<string, number>()
  let sweeping = false
  let stopped = false

  const tick = async (opts?: { onDemand?: boolean }): Promise<void> => {
    if (stopped || sweeping) return
    sweeping = true
    let enabled = false
    const outcomes: AutoPmOutcome[] = []
    // Every branch that logs also records, so the panel says exactly what the log says.
    const note = (project: AutoPmProject, started: boolean, message: string) =>
      outcomes.push({ projectId: project.id, path: project.path, started, message })
    try {
      // The preference is the cheapest gate and the one the user flips most, so it is read
      // once per sweep rather than per project. An on-demand sweep outranks it — the click is
      // the consent the preference exists to record — but still reads it, so the report says
      // where the box stood.
      enabled = await deps.enabled().catch(() => false)
      if (!enabled && !opts?.onDemand) return
      const projects = await deps.projects().catch(() => [])
      if (!projects.length) return
      // Read beside the master switch and for the same reason (#1209): it is the same preference
      // file, and a routine switched off mid-sweep should not fire for the projects still to come.
      const optedOut = new Set(await deps.optedOut?.().catch(() => []) ?? [])
      const wanted = (job: AutoPmJob | undefined) => (job && !optedOut.has(job.name) ? job : undefined)
      // The rotation, minus what is switched off. Filtered rather than skipped at the index, so
      // the cycle stays a cycle: with two of four off, the remaining two alternate instead of
      // every other tick landing on a job that cannot run.
      const rotation = deps.jobs.filter(job => !optedOut.has(job.name))
      // One reading for the whole sweep: it is an account-wide meter, and re-reading it per
      // project would spend a rate-limited call to learn the same number.
      const quota = await deps.quota().catch(() => undefined)
      for (const project of projects) {
        // Land anything a previous run produced before judging whether the queue is empty:
        // its entries are still on that run's branch, and the checkout cannot see them.
        const outstanding = pending.get(project.id) ?? []
        if (outstanding.length) {
          const stillPending: string[] = []
          let landed = 0
          for (const runId of outstanding) {
            const outcome = await deps.promote(project, runId).catch(() => ({ settled: false, promoted: false }))
            if (outcome.promoted) landed++
            if (!outcome.settled) stillPending.push(runId)
          }
          if (stillPending.length) pending.set(project.id, stillPending)
          else pending.delete(project.id)
          if (landed) {
            // The queue the decision below reads was just filled, so that read is stale. Leave it
            // to the next tick, and let the backlog loop have the work in the meantime.
            deps.log(`[framework] auto PM: landed the queue from ${landed} run(s) in ${project.path}`)
            note(project, false, `landed the queue from ${landed} finished run${landed === 1 ? '' : 's'}`)
            continue
          }
        }
        const since = lastStart.get(project.id)
        const decision = autoPmDecision({
          enabled: true,
          backlogEmpty: await deps.backlogEmpty(project).catch(() => undefined),
          activeRuns: deps.activeRuns(project),
          quota,
          ...(since !== undefined ? { sinceLastStartMs: now() - since } : {}),
          ...(deps.cooldownMs !== undefined ? { cooldownMs: deps.cooldownMs } : {}),
        })
        if (!decision.start) {
          // Logged, so a wedged sweep is distinguishable from a healthy idle one (#855).
          deps.log(`[framework] auto PM: standing down for ${project.path} — ${decision.reason}`)
          note(project, false, decision.reason)
          continue
        }
        // Switching the draining routine off (#1209) stands the sweep down rather than falling
        // through to the rotation: the queue has work waiting, and answering "do not work it
        // automatically" by inventing more work is the opposite of what was asked.
        const drainJob = wanted(deps.drainJob ?? AUTO_PM_DRAIN_JOB)
        if (decision.mode === 'drain' && !drainJob) {
          note(project, false, 'the queue has work waiting and its routine is switched off')
          continue
        }
        const index = nextJob.get(project.id) ?? 0
        // A due codebase sweep (#882) outranks the rotation: the rotation invents work, and the
        // sweep is a standing instruction to go find some. Only ever while the queue is empty --
        // a repo with entries waiting has plenty to do, and the sweep would only add more.
        //
        // Asked before the schedule is read, so a switched-off sweep costs no disk read and,
        // more importantly, leaves its calendar untouched: it must come due normally once it is
        // switched back on, rather than having been silently ticked past while it was off.
        const maintenanceJob = wanted(deps.maintenanceJob ?? AUTO_PM_MAINTENANCE_JOB)
        const sweep =
          decision.mode === 'pm' &&
          maintenanceJob !== undefined &&
          (await deps.maintenanceDue?.(project).catch(() => false)) === true
        const job = sweep ? maintenanceJob : decision.mode === 'drain' ? drainJob : rotation[index % rotation.length]
        if (!job) {
          // Told apart on purpose: a rotation emptied by the checkboxes is a setting the user can
          // see and undo, and reads nothing like a daemon wired without jobs at all.
          note(
            project,
            false,
            deps.jobs.length ? 'every routine that makes new work is switched off' : 'there is no job to run',
          )
          continue
        }
        // Re-checked here because everything above is awaited: a run spawned past a `stop()` is
        // missing from the live-run map the daemon has by then cleared, so nothing suspends or
        // terminates it (#983). Break, not continue: stopping is a verdict on the whole sweep.
        if (stopped) break
        // Armed before the spawn, not after: starting is slow, and a tick that overlapped the
        // spawn would otherwise see no live run yet and start a second one.
        lastStart.set(project.id, now())
        deps.log(`[framework] auto PM: ${doing(job)} in ${project.path}`)
        const runId = await deps.start(project, job).catch(() => undefined)
        if (runId) {
          // Advanced only on a start that took, so a refused job is retried rather than skipped.
          // Draining does not advance it: it is not part of the cycle, and a queue worked off
          // over several ticks must not skip the rotation forward once per entry.
          //
          // A sweep does not advance it either, and stamps its own schedule instead: it is paced
          // by the calendar, not the cycle, so borrowing this tick must not cost the rotation its
          // turn. Stamped after the start took for the same reason the rotation is -- a sweep the
          // daemon refused should be retried next tick, not postponed a whole interval.
          if (sweep) await deps.recordMaintenance?.(project).catch(() => {})
          else if (decision.mode === 'pm') nextJob.set(project.id, index + 1)
          // Its queue lives on the run's branch until a later tick promotes it.
          pending.set(project.id, [...(pending.get(project.id) ?? []), runId])
          note(project, true, doing(job))
        } else {
          lastStart.delete(project.id)
          deps.log(`[framework] auto PM: could not start a run in ${project.path}`)
          note(project, false, 'the daemon could not start a run')
        }
      }
    } finally {
      sweeping = false
      // Recorded even when the sweep returned early, so "switched off" and "on, and standing
      // down for a reason" are distinguishable from the dashboard (#1161).
      lastSweep = { enabled, sweptAt: now(), outcomes }
    }
  }

  const timer = setInterval(() => void tick(), intervalMs)
  timer.unref?.() // a background sweep must never be the reason the process stays up

  /** When the interval next fires, counted from the anchor so an out-of-band {@link tick} cannot skew it. */
  const nextSweepAt = () => startedAt + (Math.floor(Math.max(0, now() - startedAt) / intervalMs) + 1) * intervalMs

  // The first sweep is the caller's to fire (see `startBackgroundServices`), not this
  // constructor's: `tick` marks the loop busy synchronously, so a sweep started here would make
  // the very next `tick()` a no-op — and every test that constructs a loop and ticks it would be
  // asserting against a sweep it never awaited.
  return {
    tick,
    report: () => ({
      ...(lastSweep ? { enabled: lastSweep.enabled, sweptAt: lastSweep.sweptAt } : {}),
      nextSweepAt: nextSweepAt(),
      outcomes: lastSweep?.outcomes ?? [],
    }),
    stop: () => {
      stopped = true
      clearInterval(timer)
    },
  }
}
