import type { QuotaBoundaryStatus } from './quota-boundary.js'
import { presets } from './preset-catalog.js'
import { DEFAULT_AUTO_PM_CONCURRENCY } from './preference-defaults.js'
import { TICKETS_DIR, ticketFromQueueEntry } from './tickets.js'
import { AGENT_BRANCH_PREFIX } from './branch-names.js'

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
 * How long a project is left alone after an auto agent is started for it. A spawned agent
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
  /** Live agents on this project, measured against {@link AutoPmInputs.concurrency}. */
  activeAgents: number
  /**
   * How many agents the routine may keep going on this project at once (#1204);
   * {@link DEFAULT_AUTO_PM_CONCURRENCY} when unset. Floored at one, because zero concurrent
   * agents is what `enabled: false` already spells.
   */
  concurrency?: number
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
 * **It fails closed on a quota it cannot read, and that is the opposite of the per-agent guard.**
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
    // when the agent stopped at 63% would send someone looking for a bug that is a setting.
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
 * Whether to start a PM agent for one project right now. Every condition is a reason to
 * *not* spend the user's quota, checked cheapest first so the common "someone is working"
 * case never reaches the meter.
 */
export function autoPmDecision(input: AutoPmInputs): AutoPmDecision {
  if (!input.enabled) return { start: false, reason: 'auto PM is off' }
  const concurrency = Math.max(1, Math.floor(input.concurrency ?? DEFAULT_AUTO_PM_CONCURRENCY))
  if (input.activeAgents >= concurrency) {
    // The cap is named, for the same reason the quota refusal names its line (#960): with the
    // setting raised or lowered, "already going" on its own reads as a bug rather than a setting.
    // At one — what this was before #1204 — the old wording is kept exactly.
    const going = `${input.activeAgents} run${input.activeAgents === 1 ? ' is' : 's are'} already going`
    return { start: false, reason: concurrency === 1 ? going : `${going}, and the routine keeps at most ${concurrency} at once` }
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
  // reasoning that the backlog loop would drain it — but that loop only exists inside an agent a
  // human started, so unattended the queue filled once and nothing ever emptied it again.
  return { start: true, mode: input.backlogEmpty ? 'pm' : 'drain' }
}

/**
 * One thing auto PM knows how to do while the machine is idle (#773).
 *
 * The jobs form a cycle, and the order matters: triage turns tickets into queued work, [Plan
 * tickets] turns the rest into plans. Once a job queues something the sweep switches to draining it
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
  /**
   * The one queue entry a {@link AutoPmJob.drains} job is pinned to (#1204). Set only on the
   * per-start variants {@link pinnedDrainJob} builds: the catalog's own drain job carries none,
   * since which entry is next is known only at the moment the sweep starts one.
   */
  entry?: string
  /**
   * The branch this job's prompt pins via its constant session name, when it does (#1293). The
   * triage prompts abort when `the-framework/<SESSION_NAME>` already exists, so a leftover branch
   * whose PR was closed or merged jams the routine forever. Declared as data on the job, like
   * {@link AutoPmJob.drains}, so the sweep can release the stale name before firing without
   * matching on {@link AutoPmJob.name} at the call site.
   */
  pinnedBranch?: string
  /**
   * Merge this job's PR once its agent opens it (#1216). Set on the drain job: what it implements
   * has already been triaged as consensual, quick-win work a human could have vetoed on the
   * queue, so its PR is the one kind whose review happened before the agent. Declared as data on
   * the job for the same no-name-matching reason as {@link AutoPmJob.drains}.
   */
  autoMerge?: boolean
  /**
   * This rotation job may fan out to several agents pinned one ticket each (#1327). Only
   * [Plan tickets] declares it: unlike the other rotation jobs it writes per-ticket sibling files
   * rather than rewriting the shared queue document, so concurrent copies do disjoint work and
   * land disjoint edits — the exact property that already lets draining fan out. Declared as data
   * on the job for the same no-name-matching reason as {@link AutoPmJob.drains}.
   */
  fansOut?: boolean
  /**
   * The one ticket a fanned-out job is pinned to (#1327), as its filename inside `tickets/`. Set
   * only on the per-start variants {@link pinnedPlanJob} builds, like {@link AutoPmJob.entry} is
   * for drains: which tickets are open is known only at the moment the sweep locks them.
   */
  ticket?: string
}

/** One fanned-out agent's claim (#1327): the ticket it is pinned to, and the id its lock names. */
export interface PlanAssignment {
  /** The ticket's filename inside `tickets/`. */
  ticket: string
  /** What the `.lock.md`'s `CLAIMED: <AGENT_ID>` line carries (#1420), so an agent can tell its
   *  own claim from another's. Generated by the sweep, since no agent id exists before the agent
   *  starts. */
  agentId: string
}

/**
 * A drain job pinned to one named queue entry (#1204).
 *
 * With a single agent the stock prompt ("the FIRST open entry") is exact. With several going at
 * once it is a collision: every drain forks the same checkout, so every one of them reads the same
 * first entry and implements it as many times over. Naming the entry is what makes a batch of
 * drains work on disjoint things.
 *
 * The prompt also tells the agent to stop when the entry is already checked off or gone: the
 * assignment is a snapshot, and a human may retire the entry between the sweep's read and the
 * run's own.
 *
 * When the entry links back to a ticket the sweep has claimed (#1420), the agent is also told
 * which claim is its own — the same contract {@link pinnedPlanJob} carries, because the same
 * gap exists: without the lock the claim on the *implementation* lived only in this daemon's
 * memory, so another machine's sweep could book the same ticket. The agent removes the ticket,
 * its plan, and its lock in the PR that closes it (the ticketing format: closed tickets leave
 * the repo), because nothing else releases a lock since #1420 dropped the timer.
 */
export function pinnedDrainJob(job: AutoPmJob, entry: string, assignment?: PlanAssignment): AutoPmJob {
  const stem = assignment?.ticket.replace(/\.md$/, '')
  return {
    ...job,
    entry,
    prompt: [
      'Open TODO_AGENTS.md and work on this one open entry only, then check it off:',
      '',
      `- ${entry}`,
      '',
      'Do not start any other entry. If that entry is already checked off or no longer there, stop and do nothing.',
      ...(assignment
        ? [
            '',
            `Your claim on the entry's ticket is already in place: \`${TICKETS_DIR}/${stem}.lock.md\` holds \`CLAIMED: ${assignment.agentId}\`. In the PR that closes the ticket, remove \`${TICKETS_DIR}/${stem}.md\`, \`${TICKETS_DIR}/${stem}.plan.md\`, and \`${TICKETS_DIR}/${stem}.lock.md\` — closed tickets leave the repo, and the lock lifts when your work lands. If the lock file is missing or names a different agent, the ticket is not yours — stop and do nothing.`,
          ]
        : []),
    ].join('\n'),
    describe: `draining the queue entry "${entryPreview(entry)}"`,
  }
}

/** An entry as a log line can carry it: one line, bounded. */
function entryPreview(entry: string): string {
  const flat = entry.replace(/\s+/g, ' ').trim()
  return flat.length > 80 ? `${flat.slice(0, 80)}…` : flat
}

/**
 * A fan-out job pinned to one locked ticket (#1327).
 *
 * The stock prompt covers every ticket that has no plan or claim yet, and with a batch going out
 * that instruction is the same collision {@link pinnedDrainJob} exists for: every agent forks the
 * same checkout and would pick the same most-important ticket. The pin is *appended* to the stock
 * prompt rather than spliced into it, so the verdict rules the preset carries keep riding along
 * verbatim and a rewritten preset (the maintainer owns its wording) cannot silently lose the pin.
 *
 * The agent is also told which claim is its own: its ticket's `.lock.md` already exists with the
 * `CLAIMED:` line the daemon pushed (#1420), and finding anything else there means the
 * assignment is stale — another agent's claim, or work that landed meanwhile — so it stops. It
 * is told to delete the lock in the same commit as the plan, because nothing else releases it:
 * #1420 removed the staleness timer, so a forgotten lock stands until a human clicks it away.
 */
export function pinnedPlanJob(job: AutoPmJob, assignment: PlanAssignment): AutoPmJob {
  const { ticket, agentId } = assignment
  const stem = ticket.replace(/\.md$/, '')
  return {
    ...job,
    ticket,
    prompt: [
      job.prompt.trimEnd(),
      '',
      `You are one agent of a concurrent batch, so the scope above narrows: plan exactly one ticket, \`tickets/${ticket}\`, and no other.`,
      '',
      `Your claim on it is already in place: \`tickets/${stem}.lock.md\` holds \`CLAIMED: ${agentId}\`. Write the real \`tickets/${stem}.plan.md\`, and delete \`tickets/${stem}.lock.md\` in the same commit — the lock lifts when your work lands. If the lock file is missing, names a different agent, or a plan already exists, the ticket is not yours — stop and do nothing.`,
    ].join('\n'),
    describe: `planning "${entryPreview(ticket)}"`,
  }
}

/**
 * The default cycle: bring the tickets across from GitHub (#1208), triage the quick ones (#891),
 * then the significant-but-agreed ones (#892), and only then make more plans (#685). Planning is
 * the most expensive turn and the one whose output the earlier jobs consume, so it runs last.
 *
 * Importing leads because it is the only job that can add a ticket none of the others have seen
 * (#1334): a routine that triages and plans a set nothing ever refills eventually has nothing
 * left to do, and a new issue would wait for a human to press the button. It is safe to repeat --
 * the preset resumes from `tickets/meta.json`'s `lastImportedAt` and reconciles, so a firing with
 * nothing changed since the last one is a no-op rather than a re-import.
 *
 * This rotation is what #891/#892 mean by "with a cron job regularly firing this preset". No
 * separate scheduler is involved and none is needed: the rotation already fires on every idle tick
 * where the queue is dry, which is exactly when the queue wants refilling. That is the opposite of
 * the maintenance sweep (#882), which is paced by a calendar because it looks at static history and
 * would otherwise never come due — hence its own {@link AUTO_PM_MAINTENANCE_JOB} outside the cycle.
 *
 * The gated triage sibling (#698) is deliberately not here: it ends in `<AWAIT>`, so firing it with
 * nobody at the keyboard would park an agent against a human who will never answer.
 *
 * Each triage prompt pins its own session name and aborts if that branch already exists, so a
 * rotation that comes round again while the previous triage is still in flight is a no-op rather
 * than a duplicate. The rotation still advances past it, which is the wanted behaviour: the next
 * idle tick tries the next job instead of retrying a job that is already running.
 */
export const AUTO_PM_JOBS: readonly AutoPmJob[] = [
  {
    name: presets.updateTickets.name,
    prompt: presets.updateTickets.render(),
    label: presets.updateTickets.label,
  },
  {
    name: presets.triageQuick.name,
    prompt: presets.triageQuick.render(),
    label: presets.triageQuick.label,
    pinnedBranch: `${AGENT_BRANCH_PREFIX}${presets.triageQuick.name}`,
  },
  {
    name: presets.triageConsensual.name,
    prompt: presets.triageConsensual.render(),
    label: presets.triageConsensual.label,
    pinnedBranch: `${AGENT_BRANCH_PREFIX}${presets.triageConsensual.name}`,
  },
  {
    name: presets.planTickets.name,
    prompt: presets.planTickets.render(),
    label: presets.planTickets.label,
    fansOut: true,
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
  autoMerge: true,
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
 * What became of one attempt to land an agent's queue (#852). The two flags are separate on purpose:
 * a finished agent that wrote no queue is `settled` without being `promoted`, and must stop being
 * retried; a still-running one is neither, and is tried again next tick.
 */
export interface PromoteOutcome {
  /** Stop tracking this agent: it is finished, whether or not it left anything behind. */
  settled: boolean
  /** The checkout's queue actually changed. */
  promoted: boolean
}

/** A project the sweep considers. */
export interface AutoPmProject {
  /** Registry id, as `start` and the live-agent lookup take it. */
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
  /**
   * The open entries of a project's agent queue, in file order. Empty = the queue has run dry, and
   * a rejection = it could not be read, which fails closed exactly as the old boolean did (#855).
   * The entries themselves rather than just emptiness, because a batch of drains is pinned one
   * entry each (#1204) and the assignment has to come from the read the decision was made on.
   */
  queue(project: AutoPmProject): Promise<readonly string[]>
  /** How many agents are live on a project. */
  activeAgents(project: AutoPmProject): number
  /**
   * How many agents the routine may keep going per project (#1204). Re-read per tick like
   * {@link AutoPmDeps.enabled}, so the setting takes effect without a restart. Unset or unreadable
   * falls back to {@link DEFAULT_AUTO_PM_CONCURRENCY} rather than to one: the absence of the
   * setting has never meant "less".
   */
  concurrency?(): Promise<number | undefined>
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
  /** Start the PM agent. Resolves the agent's id, or undefined when the daemon refused. */
  start(project: AutoPmProject, job: AutoPmJob): Promise<string | undefined>
  /**
   * Release a {@link AutoPmJob.pinnedBranch} its closed PR left behind (#1293), called right
   * before such a job fires. Injected because the release reads `gh` and mutates git, and this
   * module is pure policy. Omitted (or throwing) means the branch stays and the job's own abort
   * guard decides, exactly as before the seam existed.
   */
  releasePinned?(project: AutoPmProject, branch: string): Promise<unknown>
  /**
   * Land a finished agent's queue in the project checkout (#852). Called before the sweep decides
   * anything: an agent's queue lives on its own worktree branch, so until it is promoted the checkout
   * still reads empty and the sweep would start the same work over again.
   */
  promote(project: AutoPmProject, agent: { agentId: string; entry?: string }): Promise<PromoteOutcome>
  /**
   * The tickets open for planning (#1327): no plan or `.lock.md` claim yet (#1420) — most
   * important first, as filenames inside `tickets/`. Asked only when the tick lands on a
   * {@link AutoPmJob.fansOut} job. Unreadable means none, and no seam at all means the stock
   * single driver: the fan-out is an addition, not a precondition, and a loop wired without it
   * behaves exactly as before #1327.
   */
  planCandidates?(project: AutoPmProject): Promise<readonly string[]>
  /**
   * Claim `assignments`' tickets before their agents start (#1327/#1420): one `.lock.md` sibling
   * per ticket reading `CLAIMED: <AGENT_ID>`, committed as one batch and pushed to the default
   * branch, so agents forked from any checkout — and cloud sessions, which is the point — find
   * the file and skip the ticket. Resolves the subset actually locked: a ticket lost to a race
   * locks fewer, and each missing lock costs one agent of the batch rather than the batch.
   * Failing (or absent) resolves nothing locked, and the sweep falls back to the stock single
   * agent — one unpinned agent is what ran before #1327 and needs no lock to be safe.
   */
  lockPlans?(
    project: AutoPmProject,
    assignments: readonly PlanAssignment[],
  ): Promise<readonly PlanAssignment[]>
  /**
   * Claim the tickets a drain batch is about to implement (#1420), the same way
   * {@link AutoPmDeps.lockPlans} claims them for planning — one pushed `.lock.md` per ticket —
   * but skipping only on an existing lock: a `.plan.md` is the drain's input, not a competing
   * claim. Asked only for the entries that link back to a ticket; a self-contained TODO has
   * nothing on disk to lock and keeps the queue document as its coordination point. Resolves the
   * subset actually locked — an entry whose ticket was claimed elsewhere is dropped from the
   * batch, and the next tick reconsiders it. Absent, drains run exactly as before this seam:
   * the in-memory pin still guards this daemon's own fan-out.
   */
  lockDrains?(
    project: AutoPmProject,
    assignments: readonly PlanAssignment[],
  ): Promise<readonly PlanAssignment[]>
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
  /** Whether an agent was started for it. */
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
   * reason to stand down (live agents, cooldowns, the quota boundary, unticked routines) still holds.
   *
   * `drainOnly` narrows the sweep to working the queue (#1204): the drain row's Run now means
   * "spin agents up on the queue", so a tick that would fall through to a rotation job (the queue
   * is empty) says so instead of borrowing the click for work nobody asked for.
   */
  tick(opts?: { onDemand?: boolean; drainOnly?: boolean }): Promise<void>
  /** What the last sweep decided, for the dashboard to show (#1161). */
  report(): AutoPmReport
  stop(): void
}

/**
 * Start the auto-PM sweep (#685): every {@link DEFAULT_AUTO_PM_INTERVAL_MS}, ask
 * {@link autoPmDecision} for each project and start an agent for the ones that say yes.
 *
 * Ticks never overlap — a sweep reads a live-agent map that its own `start` calls mutate,
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
  // Runs this loop started whose queue has not reached the checkout yet, oldest first. A drain
  // remembers the entry it was pinned to (#1204), and a fanned-out plan agent its ticket (#1327), so
  // while either is still in flight a later tick does not hand the same work to a second agent.
  const pending = new Map<string, { agentId: string; entry?: string; ticket?: string }[]>()
  // Where each project is in the job cycle. Per project, not global: two repos idle at once
  // should each work through the rotation, not take alternate halves of it.
  const nextJob = new Map<string, number>()
  let sweeping = false
  let stopped = false

  const tick = async (opts?: { onDemand?: boolean; drainOnly?: boolean }): Promise<void> => {
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
      // How many agents each project may keep going (#1204). Read beside the opt-outs and for the
      // same reason: it is the same preference file, re-read so the setting takes effect
      // mid-schedule. Floored at one, since zero agents is the master switch's job.
      const concurrency = Math.max(
        1,
        Math.floor((await deps.concurrency?.().catch(() => undefined)) ?? DEFAULT_AUTO_PM_CONCURRENCY),
      )
      for (const project of projects) {
        // Land anything a previous agent produced before judging whether the queue is empty:
        // its entries are still on that agent's branch, and the checkout cannot see them.
        const outstanding = pending.get(project.id) ?? []
        if (outstanding.length) {
          const stillPending: { agentId: string; entry?: string }[] = []
          let landed = 0
          for (const agent of outstanding) {
            const outcome = await deps.promote(project, agent).catch(() => ({ settled: false, promoted: false }))
            if (outcome.promoted) landed++
            if (!outcome.settled) stillPending.push(agent)
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
        const entries = await deps.queue(project).catch(() => undefined)
        const activeAgents = deps.activeAgents(project)
        const since = lastStart.get(project.id)
        const decision = autoPmDecision({
          enabled: true,
          backlogEmpty: entries === undefined ? undefined : entries.length === 0,
          activeAgents: activeAgents,
          concurrency,
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
        const drainJob = wanted(deps.drainJob ?? AUTO_PM_DRAIN_JOB)
        // A drain-only sweep (#1204) works the queue or says why not — it never borrows the
        // click for a rotation job the user did not ask for. Logged like every other stand-down
        // (#855/#1433): these two used to be the only silent ones.
        if (opts?.drainOnly) {
          if (decision.mode !== 'drain') {
            deps.log(`[framework] auto PM: standing down for ${project.path} — the queue is empty, so there is nothing to drain`)
            note(project, false, 'the queue is empty, so there is nothing to drain')
            continue
          }
          if (!drainJob) {
            deps.log(`[framework] auto PM: standing down for ${project.path} — the queue has work waiting and its routine is switched off`)
            note(project, false, 'the queue has work waiting and its routine is switched off')
            continue
          }
        }
        /**
         * What this tick does, which is the queue-picked mode (#855) unless the draining routine
         * is switched off — then the rotation gets the tick instead of the sweep standing down.
         *
         * #1209 means "do not *work* the queue", and the rotation does not work it: triage and
         * planning put entries *on* it. Standing down here read that switch as "do nothing at
         * all", which made every inventing routine unreachable for as long as the queue had
         * anything on it — and since the queue is auto-populated, that is most of the time. The
         * only way to reach `Spike & plan` was to empty the queue by hand (#1432).
         *
         * A drain-only sweep never gets here: it has already stood down above, because the click
         * that fires it asked for the queue specifically.
         */
        const mode: 'pm' | 'drain' = decision.mode === 'drain' && !drainJob ? 'pm' : decision.mode
        const index = nextJob.get(project.id) ?? 0
        // A due codebase sweep (#882) outranks the rotation: the rotation invents work, and the
        // sweep is a standing instruction to go find some. Only ever while the queue is empty --
        // a repo with entries waiting has plenty to do, and the sweep would only add more.
        //
        // Asked before the schedule is read, so a switched-off sweep costs no disk read and,
        // more importantly, leaves its calendar untouched: it must come due normally once it is
        // switched back on, rather than having been silently ticked past while it was off.
        // `decision.mode`, not the effective `mode` above: the question here is whether the queue
        // is genuinely empty, and a tick that fell through to the rotation because draining is
        // switched off still has entries waiting — exactly the case this sweep stays out of.
        const maintenanceJob = wanted(deps.maintenanceJob ?? AUTO_PM_MAINTENANCE_JOB)
        const sweep =
          decision.mode === 'pm' &&
          maintenanceJob !== undefined &&
          (await deps.maintenanceDue?.(project).catch(() => false)) === true
        const job = sweep ? maintenanceJob : mode === 'drain' ? drainJob : rotation[index % rotation.length]
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
        // What to start this tick (#1204/#1327). Draining fans out, and so does a rotation job
        // that declares {@link AutoPmJob.fansOut} — the property both share is what each agent
        // does to shared files: a drain takes one entry *off* the queue, a pinned plan agent writes
        // one ticket's *own* sibling files, so several agents do disjoint work and land disjoint
        // edits. Every other rotation job rewrites the whole queue document from the same fork
        // point, so two at once would revert each other's promotion; those stay one per tick.
        const batch: AutoPmJob[] = [job]
        if (mode === 'drain') {
          // An entry an agent still in flight was pinned to is not offered again.
          const assigned = new Set(
            (pending.get(project.id) ?? []).flatMap(agent => (agent.entry !== undefined ? [agent.entry] : [])),
          )
          // An entry someone else already worked is not on the queue to begin with (E2): the
          // check-off travels in that agent's own PR, and the merge is what takes it off. A third
          // claim used to be re-derived here — from agent metas, their PRs, and the queue diffs of
          // open PRs on other machines — which is a guess assembled at read time rather than a
          // claim anyone wrote down.
          const open = (entries ?? []).filter(entry => !assigned.has(entry))
          if (!open.length) {
            note(project, false, 'every open queue entry is already being worked on')
            continue
          }
          const picks = open.slice(0, concurrency - activeAgents)
          // The cross-machine claim on what a drain *implements* (#1420): an entry that links
          // back to a ticket (#1164) gets its `.lock.md` before its agent starts, the same
          // pushed claim planning already makes — without it the booking lived only in this
          // daemon's `pending` map, and another machine's sweep could implement the same ticket.
          // A ticketless entry has nothing on disk to lock and proceeds as before. Ids are
          // generated here for the same reason plan ids are: the lock's CLAIMED line and the
          // pinned prompt must agree.
          const linked = new Map(
            picks.flatMap((entry, i) => {
              const ticket = ticketFromQueueEntry(entry)
              return ticket
                ? [[entry, { ticket: ticket.slice(TICKETS_DIR.length + 1), agentId: `drain-${now()}-${i}` }] as const]
                : []
            }),
          )
          // Matched back by agent id, not ticket: two entries linking the same ticket race for
          // one lock, and only the assignment whose id the lock actually names may carry it.
          const locked = new Set(
            deps.lockDrains && linked.size
              ? (await deps.lockDrains(project, [...linked.values()]).catch(() => [])).map(a => a.agentId)
              : [],
          )
          batch.length = 0
          batch.push(
            ...picks.flatMap(entry => {
              const assignment = linked.get(entry)
              // No seam wired means no claim to carry: the entry drains exactly as before #1420.
              if (!assignment || !deps.lockDrains) return [pinnedDrainJob(job, entry)]
              // A lost race costs this batch the entry, not the batch: the claim that won it is
              // pushed, so the check-off will arrive in that agent's own PR.
              return locked.has(assignment.agentId) ? [pinnedDrainJob(job, entry, assignment)] : []
            }),
          )
          if (!batch.length) {
            note(project, false, 'every entry in this batch links a ticket another agent already claimed')
            continue
          }
        } else if (job.fansOut && deps.planCandidates && deps.lockPlans) {
          // The fan-out for a rotation job that writes per-ticket files (#1327). Both seams or
          // neither: candidates without locks would fan out unguarded, which is exactly the
          // double-work the locks exist to prevent — so a loop wired without them keeps the
          // stock single agent already in the batch.
          //
          // A ticket an agent still in flight was pinned to is not offered again, same as a drain's
          // entry. The durable half is the lock files themselves: unlike drain entries, the claim
          // is on disk and pushed, so no #1253-style meta lookup is needed here.
          const pinned = new Set(
            (pending.get(project.id) ?? []).flatMap(agent => (agent.ticket !== undefined ? [agent.ticket] : [])),
          )
          const candidates = ((await deps.planCandidates(project).catch(() => [])) ?? []).filter(
            ticket => !pinned.has(ticket),
          )
          if (!candidates.length) {
            // Nothing left to plan is this job's work being done, not a refusal: the rotation
            // advances, so the next tick tries the next job instead of re-asking forever.
            nextJob.set(project.id, index + 1)
            note(project, false, 'every open ticket already has a plan, or an agent on the way to one')
            continue
          }
          // Ids are generated here rather than by the lock writer, because the id has to reach
          // two places that must agree: the lock file's CLAIMED line and the pinned prompt that
          // tells the agent which claim is its own. Clock+index rather than randomness, so a
          // test with an injected clock can predict them.
          const assignments = candidates
            .slice(0, concurrency - activeAgents)
            .map((ticket, i) => ({ ticket, agentId: `plan-${now()}-${i}` }))
          const locked = await deps.lockPlans(project, assignments).catch(() => [])
          if (locked.length) {
            batch.length = 0
            batch.push(...locked.map(assignment => pinnedPlanJob(job, assignment)))
          }
          // Nothing locked falls through with the stock single job: one unpinned agent is the
          // pre-#1327 behavior, and safe without a lock.
        }
        // Re-checked here because everything above is awaited: an agent spawned past a `stop()` is
        // missing from the live-agent map the daemon has by then cleared, so nothing suspends or
        // terminates it (#983). Break, not continue: stopping is a verdict on the whole sweep.
        if (stopped) break
        // Armed before the first spawn and once for the whole batch: starting is slow, and a tick
        // that overlapped the spawns would otherwise see too few live agents and top up past the cap.
        lastStart.set(project.id, now())
        const started: AutoPmJob[] = []
        for (const item of batch) {
          // Re-checked per spawn, for the reason (#983) above: a stop mid-batch must not spawn the rest.
          if (stopped) break
          deps.log(`[framework] auto PM: ${doing(item)} in ${project.path}`)
          // A pinned-name job aborts itself when its branch already exists (#1293); a branch
          // whose PR closed is not a pending triage, so it is released before the start.
          if (item.pinnedBranch) await deps.releasePinned?.(project, item.pinnedBranch).catch(() => undefined)
          const agentId = await deps.start(project, item).catch(() => undefined)
          if (!agentId) {
            // The batch ends at the first refusal: whatever refused this start is not going to take
            // the next one a moment later, and a refused job must be retried rather than skipped.
            deps.log(`[framework] auto PM: could not start a run in ${project.path}`)
            break
          }
          started.push(item)
          // Its queue lives on the agent's branch until a later tick promotes it.
          pending.set(project.id, [
            ...(pending.get(project.id) ?? []),
            {
              agentId,
              ...(item.entry !== undefined ? { entry: item.entry } : {}),
              ...(item.ticket !== undefined ? { ticket: item.ticket } : {}),
            },
          ])
        }
        if (started.length) {
          // Advanced only on a start that took, so a refused job is retried rather than skipped.
          // Draining does not advance it: it is not part of the cycle, and a queue worked off
          // over several ticks must not skip the rotation forward once per entry.
          //
          // A sweep does not advance it either, and stamps its own schedule instead: it is paced
          // by the calendar, not the cycle, so borrowing this tick must not cost the rotation its
          // turn. Stamped after the start took for the same reason the rotation is -- a sweep the
          // daemon refused should be retried next tick, not postponed a whole interval.
          if (sweep) await deps.recordMaintenance?.(project).catch(() => {})
          else if (mode === 'pm') nextJob.set(project.id, index + 1)
          // One line per project however many agents went out, and a single start keeps the old
          // wording exactly.
          const described = started.map(item => doing(item)).join('; ')
          note(project, true, started.length === 1 ? described : `started ${started.length} agents: ${described}`)
        } else if (!stopped) {
          // Nothing took, so the cooldown armed above is given back: a batch that started nothing
          // spent nothing, and holding it would strand the project for a whole cooldown.
          lastStart.delete(project.id)
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

  // No timer of its own (E4): the daemon's one clock calls `tick` every Nth turn. `intervalMs`
  // stays as the *declared* cadence — the clock runs this at that multiple, and `nextSweepAt`
  // below is what the usage panel reads to say when the next sweep is due.

  /** When the sweep is next due, counted from the anchor so an out-of-band {@link tick} cannot skew it. */
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
    },
  }
}
