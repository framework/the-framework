import type { QuotaBoundaryStatus } from './quota-boundary.js'
import type { AutoHandoffSkip } from './events.js'
import { presets } from './preset-catalog.js'
import { DEFAULT_AUTO_PM_CONCURRENCY } from './preference-defaults.js'
import { agentIdFromStartedAt } from './agent-id.js'

/**
 * Auto PM (#685): spend leftover subscription quota on product management instead of
 * letting it expire. While the account is still under its quota boundary (#879) and nobody
 * is at the keyboard, the daemon runs the cycle by itself: it starts an agent on the queued work
 * whenever the `agent-data` branch moved (#1774), and once a run finds nothing queued it refills
 * the queue — triaging tickets, then spiking and planning the ones that have neither yet.
 *
 * The daemon reads no queue and names no skill (#1774). It watches one thing, the head of the
 * `agent-data` branch, and reacts to the commits it did not write itself: someone queued an entry,
 * an agent claimed or closed a ticket. The agent started for that reads the skills in its checkout
 * and takes one queued task; its own commits move the branch again, so the daemon fires again as
 * the run ends, and the chain drains the queue by itself. A run that finds nothing writes nothing,
 * and the chain stops. One heartbeat a day is the belt.
 *
 * The whole feature is one policy question ("is now a good time to spend tokens on our
 * own roadmap?"), so that question lives here as a pure function and the daemon only
 * supplies the readings. #298 is the parent idea (background jobs / "max out the usage"),
 * and #879 defines the boundary this reads.
 */

/** How often the daemon looks at the branch and re-asks {@link autoPmDecision}: right after each data pull. */
export const DEFAULT_AUTO_PM_INTERVAL_MS = 60 * 1000

/**
 * How long a project is left alone after the rotation starts an agent for it. The rotation
 * invents work on an idle project, and this is what paces it. A move of the branch is never
 * paced: someone, or an agent, asked for that run.
 */
const DEFAULT_AUTO_PM_COOLDOWN_MS = 30 * 60 * 1000

/**
 * The belt (#1774): a run on the queued work once a day even when nothing moved, so a branch the
 * daemon missed a move on — a range git could not walk, a restart between a push and the look —
 * is looked at by an agent within a day.
 */
export const DEFAULT_AUTO_PM_HEARTBEAT_MS = 24 * 60 * 60 * 1000

/** What the policy was told about one project at one moment. */
export interface AutoPmInputs {
  /** The `autoPm` preference. Off = the feature does nothing at all. */
  enabled: boolean
  /** Live agents on this project, measured against {@link AutoPmInputs.concurrency}. */
  activeAgents: number
  /**
   * What holds each of those slots (#1646), one label per run, for the stand-down's wording. A
   * cap reached by a process the Agents panel no longer shows looked exactly like one reached by
   * real work; named, the reader can go and look at the run it names.
   */
  running?: readonly string[]
  /**
   * How many agents the routine may keep going on this project at once (#1204);
   * {@link DEFAULT_AUTO_PM_CONCURRENCY} when unset. Floored at one, because zero concurrent
   * agents is what `enabled: false` already spells.
   */
  concurrency?: number
  /** Where the account stands against its quota boundary, or `undefined` when it could not be read. */
  quota: QuotaBoundaryStatus | undefined
  /**
   * Milliseconds since the rotation last started an agent for this project, or `undefined` when
   * the cooldown does not apply: the rotation never did, or this start is for a move of the branch.
   */
  sinceLastStartMs?: number
  /** Override {@link DEFAULT_AUTO_PM_COOLDOWN_MS}. */
  cooldownMs?: number
  /**
   * A person asked for this pass (#1210's Run now), so the cooldown does not apply (#1642): it
   * paces work nobody asked for, and a click is asking. The concurrency cap still does — that is
   * what keeps a second click from doubling up, since a start registers before the sweep moves on.
   */
  onDemand?: boolean
}

/** Why the sweep is not starting anything. Logged, so it reads as a sentence. */
export type AutoPmRefusal = { start: false; reason: string }

/** Whether the budget allows spending unasked at all, before asking what to spend it on. */
export type QuotaDecision = { start: true } | AutoPmRefusal

/** Start, or the reason not to. */
export type AutoPmDecision = { start: true } | AutoPmRefusal

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
 * Whether to start an agent for one project right now. Every condition is a reason to
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
    // Which runs, when the reading says (#1646): the one time this wording mattered, the runs it
    // counted were nowhere on the dashboard, and a number could not be questioned.
    const named = input.running?.length ? ` (${input.running.join(', ')})` : ''
    const going = `${input.activeAgents} run${input.activeAgents === 1 ? ' is' : 's are'} already going${named}`
    return { start: false, reason: concurrency === 1 ? going : `${going}, and the routine keeps at most ${concurrency} at once` }
  }
  const cooldownMs = input.cooldownMs ?? DEFAULT_AUTO_PM_COOLDOWN_MS
  if (!input.onDemand && input.sinceLastStartMs !== undefined && input.sinceLastStartMs < cooldownMs) {
    return { start: false, reason: 'a run was started for this project a moment ago' }
  }
  return quotaHeadroom(input.quota)
}

/**
 * One thing auto PM knows how to do while the machine is idle (#773).
 *
 * The jobs form a cycle, and the order matters: triage turns tickets into queued work, [Plan
 * tickets] turns the rest into plans. Once a job queues something the branch moves and the queued
 * work is started (#1774); the rotation resumes where it left off once a run finds nothing queued.
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
   * The preset's own one-line "what this does" (#1506), for a surface that has to say what a click
   * is about to spend an agent on before it spends it. Read off the preset like
   * {@link AutoPmJob.label}, so the sentence the launcher shows for a preset and the sentence the
   * routines list shows for its routine are the same sentence. Absent for a preset without one.
   */
  tooltip?: string | undefined
  /**
   * This job works the queued work rather than making more of it (#1774): the daemon fires it
   * when the `agent-data` branch moved, and a Run now on its row is that same fire, asked for.
   * Declared here rather than matched on {@link AutoPmJob.name} at the call site, so the job says
   * what it does and a rename cannot quietly unhook it.
   */
  works?: boolean
  /**
   * The routine lock this job holds while it runs (#1659), as `routines/<lock>.lock.md` on the
   * agent-data branch: the triage routines rewrite the shared queue and may take hours, so no two may
   * run at once, on any machine. The sweep mints it before the start and releases it when the
   * run ends. Declared as data on the job, like {@link AutoPmJob.works}, so the sweep never
   * matches on {@link AutoPmJob.name} at the call site.
   */
  lock?: string
  /**
   * Merge this job's PR once its agent opens it (#1216). Set on the job that works the queue: what
   * it implements has already been triaged as consensual, quick-win work a human could have vetoed
   * on the queue, so its PR is the one kind whose review happened before the agent. Declared as
   * data on the job for the same no-name-matching reason as {@link AutoPmJob.works}.
   */
  autoMerge?: boolean
  /**
   * This rotation job may fan out to several agents pinned one ticket each (#1327). Only
   * [Plan tickets] declares it: unlike the other rotation jobs it writes per-ticket sibling files
   * rather than rewriting the shared queue document, so concurrent copies do disjoint work and
   * land disjoint edits. Declared as data on the job for the same no-name-matching reason as
   * {@link AutoPmJob.works}.
   */
  fansOut?: boolean
  /**
   * The one ticket a fanned-out job is pinned to (#1327), as its filename inside `tickets/`. Set
   * only on the per-start variants {@link pinnedPlanJob} builds: which tickets are open is known
   * only at the moment the sweep locks them.
   */
  ticket?: string
  /**
   * The `.lock.md` claim the sweep minted for this start (#1420/#1583), on the pinned variants.
   * What lets the sweep free the claim itself when the agent settles with nothing to hand off:
   * the agent's PR is what normally deletes the lock, and an agent that never made a commit is
   * never opening one.
   */
  claim?: PlanAssignment
}

/** One fanned-out agent's claim (#1327): the ticket it is pinned to, and the id its lock names. */
export interface PlanAssignment {
  /** The ticket's filename inside `tickets/`. */
  ticket: string
  /**
   * The agent's id: what the `.lock.md`'s `CLAIMED:` line carries (#1420/#1748) and the id the
   * agent is then started with, so the claim and the run are one. Minted by the sweep before the
   * claim, the way a start would mint it a moment later ({@link agentIdFromStartedAt}).
   */
  agentId: string
}

/**
 * The ids a batch is born with (#1748): one per assignment, minted from the sweep's clock the way
 * a start mints them — a millisecond apart, so a batch minted in one tick stays distinct. The
 * lock names the id, the pinned prompt does not have to: `tickets show` names the holder.
 */
function mintAgentIds(now: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => agentIdFromStartedAt(new Date(now + i).toISOString()))
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
 * that instruction is a collision: every agent forks the same checkout and would pick the same
 * most-important ticket. The pin is *appended* to the stock prompt rather than spliced into it,
 * so the verdict rules the preset carries keep riding along verbatim and a rewritten preset (the
 * maintainer owns its wording) cannot silently lose the pin.
 *
 * The agent is also told which claim is its own: its ticket's `.lock.md` already exists with the
 * `CLAIMED:` line the daemon pushed (#1420), and finding anything else there means the
 * assignment is stale — another agent's claim, or work that landed meanwhile — so it stops. It
 * is told to delete the lock in the same data-branch commit as the plan (#1582), because nothing
 * else releases it: #1420 removed the staleness timer, so a forgotten lock stands until a human
 * clicks it away.
 */
export function pinnedPlanJob(job: AutoPmJob, assignment: PlanAssignment): AutoPmJob {
  const { ticket, agentId } = assignment
  const stem = ticket.replace(/\.md$/, '')
  return {
    ...job,
    ticket,
    claim: assignment,
    prompt: [
      job.prompt.trimEnd(),
      '',
      `You are one agent of a concurrent batch, so the scope above narrows: plan exactly one ticket, \`tickets/${ticket}\`, and no other.`,
      '',
      `The ticket is already claimed for you (use the \`tickets\` skill): \`tickets show ${ticket}\` names you as its holder. Write the plan with \`tickets put ${stem}.plan.md\`, then lift your claim with \`tickets release ${ticket}\` — the plan is a write to the \`agent-data\` branch, not a PR. If the ticket is not claimed, is claimed by someone else, or already has a plan, it is not yours — stop and do nothing.`,
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
 * separate scheduler is involved and none is needed: the rotation fires after every run that found
 * nothing queued, which is exactly when the queue wants refilling. That is the opposite of
 * the maintenance sweep (#882), which is paced by a calendar because it looks at static history and
 * would otherwise never come due — hence its own {@link AUTO_PM_MAINTENANCE_JOB} outside the cycle.
 *
 * The presets that end in `<AWAIT>` (Research, Suggest tickets to work on) are deliberately not
 * here: firing one with nobody at the keyboard would park an agent against a human who will never
 * answer.
 *
 * Each triage prompt pins its own session name, so a triage always lands on the same branch. What
 * keeps a rotation from triaging twice is the routine lock (`routine-locks.ts`), taken before the
 * agent starts: a firing that finds the lock held stands down without spending an agent, and the
 * rotation advances past it rather than retrying a job that is already running.
 */
export const AUTO_PM_JOBS: readonly AutoPmJob[] = [
  {
    name: presets.updateTickets.name,
    prompt: presets.updateTickets.render(),
    label: presets.updateTickets.label,
    tooltip: presets.updateTickets.tooltip,
  },
  {
    name: presets.triageQuick.name,
    prompt: presets.triageQuick.render(),
    label: presets.triageQuick.label,
    tooltip: presets.triageQuick.tooltip,
    lock: presets.triageQuick.name,
  },
  {
    name: presets.triageConsensual.name,
    prompt: presets.triageConsensual.render(),
    label: presets.triageConsensual.label,
    tooltip: presets.triageConsensual.tooltip,
    lock: presets.triageConsensual.name,
  },
  {
    name: presets.planTickets.name,
    prompt: presets.planTickets.render(),
    label: presets.planTickets.label,
    tooltip: presets.planTickets.tooltip,
    fansOut: true,
  },
]

/**
 * The command skill the daemon fires on the queued work (#1774): `work-queue`, a skill file the
 * project tracks under `.claude/skills/<command>`, marked so that only a person or the daemon
 * invokes it. Its prompt is the slash command; the agent's harness expands it. The daemon ships
 * no skill file, links none into a checkout and depends on no skill package.
 */
export const WORK_QUEUE_SKILL_NAME = 'work-queue'

/**
 * The job for the queued work (#1774): one agent, told nothing but `/work-queue`, takes one
 * queued task off the queue by composing the skills in its checkout. Outside the rotation on
 * purpose — the rotation is about what to *make* when there is nothing to do, and this is the
 * thing to do. Its label and tooltip are written here: the routine is a skill file, not a preset.
 */
export const AUTO_PM_WORK_JOB: AutoPmJob = {
  name: WORK_QUEUE_SKILL_NAME,
  prompt: `/${WORK_QUEUE_SKILL_NAME}`,
  label: 'Work the queue',
  tooltip: 'Work one queued task off the agent queue, unattended.',
  works: true,
  autoMerge: true,
}

/**
 * The periodic codebase-wide sweep (#882): fire the [Maintenance] preset (#881) so a repo that
 * adopted The Framework late gets its pre-existing history looked at.
 *
 * Outside the rotation, like {@link AUTO_PM_WORK_JOB} and for the same kind of reason: the
 * rotation is "what to make next" and cycles on every run that found nothing queued, while this is
 * paced by a calendar and must not advance or be advanced by the cycle. It takes precedence over
 * the rotation when due, because the entries it queues are what the rotation would otherwise be
 * inventing work instead of.
 *
 * The prompt renders at module load with no session, so `tf.params.what` falls back to its
 * default of the entire codebase, which is exactly this job's scope.
 */
export const AUTO_PM_MAINTENANCE_JOB: AutoPmJob = {
  name: presets.maintenance.name,
  prompt: presets.maintenance.render(),
  describe: 'sweeping the codebase for maintenance work',
  label: presets.maintenance.label,
  tooltip: presets.maintenance.tooltip,
}

/**
 * Every routine the sweep can fire, in the order a surface should list them (#1159).
 *
 * Derived from the three constants above rather than written out again, so the list the dashboard
 * shows and the jobs the daemon actually runs cannot drift. The order is the sweep's own precedence
 * (#855/#882 read the other way round): the queued work comes first because it is what happens
 * whenever the branch moved, the rotation is what happens when a run found nothing, and the
 * calendar-paced maintenance sweep is the exception outside both.
 */
export const AUTO_PM_ROUTINES: readonly AutoPmJob[] = [
  AUTO_PM_WORK_JOB,
  ...AUTO_PM_JOBS,
  AUTO_PM_MAINTENANCE_JOB,
]

/** The sentence a start is reported as: the log line and the outcome message say the same thing. */
const doing = (job: AutoPmJob) => job.describe ?? job.label ?? job.name

/**
 * What became of one look at an agent this loop started. A finished agent is `settled` and stops
 * being asked about; a still-running one is not, and is asked again next tick.
 */
export interface SettleOutcome {
  /** Stop tracking this agent: it is finished. */
  settled: boolean
  /**
   * Why the settled run's handoff skipped, when its record says so (#1583). The sweep needs
   * exactly one fact from the record: a run that ended `no-commits` will never open the PR that
   * lifts the `.lock.md` it was started under, so the sweep releases that claim itself.
   */
  handoffSkip?: AutoHandoffSkip
  /**
   * The run finished cleanly but its epilogue has not reported yet (#1583): the `end` lands
   * before the handoff does its work, so a sweep can catch the gap between them. A claim-carrying
   * agent observed there is held pending a little longer rather than settled — settling would
   * drop the claim with the ending unread, and the release would be missed for good.
   */
  handoffPending?: boolean
}

/** A project the sweep considers. */
export interface AutoPmProject {
  /** Registry id, as `start` and the live-agent lookup take it. */
  id: string
  /** Absolute repo path, for reading its branch. */
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
   * The local head of the project's `agent-data` branch (#1774), or `undefined` when the branch
   * does not exist yet. Read after the daemon's data pull, so it says what other machines and the
   * agents pushed.
   */
  dataHead(project: AutoPmProject): Promise<string | undefined>
  /**
   * How many commits between two heads of the branch were written by something other than a
   * daemon (#1774): a person queuing an entry, an agent claiming or closing a ticket. The daemon's
   * own writes — a run's record, a routine lock, a claim — carry a trailer and are not counted,
   * or every record would start the next run.
   */
  foreignCommits(project: AutoPmProject, from: string, to: string): Promise<number>
  /**
   * The agents live on a project, one label each (#1646) — the run's id and pid, as the daemon
   * holds them. Their number is what the cap is measured against; their names are what the
   * stand-down and the fan-out say, so a slot held by a process the dashboard no longer shows
   * names itself rather than reading as a bug in the count.
   */
  activeAgents(project: AutoPmProject): readonly string[]
  /**
   * How many agents the routine may keep going per project (#1204). Re-read per tick like
   * {@link AutoPmDeps.enabled}, so the setting takes effect without a restart. Unset or unreadable
   * falls back to {@link DEFAULT_AUTO_PM_CONCURRENCY} rather than to one: the absence of the
   * setting has never meant "less".
   */
  concurrency?(): Promise<number | undefined>
  /**
   * Where the account stands against its boundary for the work *this project* would start, or
   * `undefined` when there is no reading.
   *
   * Asked per project rather than once per sweep (#1619): the model is a project-resolvable
   * setting, and the model's own weekly window binds alongside the account's (#879) — so two
   * projects on two models can stand at two different places against the same reading.
   */
  quota(project: AutoPmProject): Promise<QuotaBoundaryStatus | undefined>
  /** The jobs to rotate through, in cycle order. Used once a run found nothing queued. */
  jobs: readonly AutoPmJob[]
  /** The job for the queued work (#1774); {@link AUTO_PM_WORK_JOB} by default. */
  workJob?: AutoPmJob
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
  /** Start the agent. Resolves the agent's id, or undefined when the daemon refused. */
  start(project: AutoPmProject, job: AutoPmJob): Promise<string | undefined>
  /**
   * Take a job's {@link AutoPmJob.lock} before its run starts (#1659): `routines/<lock>.lock.md`
   * on the agent-data branch, pushed, so every machine sharing it sees the routine as taken. `ok: false`
   * stands the job down with the reason — the lock's holder, or a write that could not land.
   * Omitted, the job starts unguarded.
   */
  lockRoutine?(project: AutoPmProject, lock: string): Promise<{ ok: true } | { ok: false; reason: string }>
  /**
   * Drop this daemon's {@link AutoPmJob.lock} once its run has ended, whatever the ending
   * (#1659): a triage never opens the PR that would lift a ticket claim. `false` when the release
   * could not land, so the loop holds the agent and retries next sweep.
   */
  releaseRoutine?(project: AutoPmProject, lock: string): Promise<boolean>
  /**
   * Drop the locks a previous daemon on this machine left behind whose runs are gone (#1659).
   * Asked once per project, on the project's first sweep: this loop holds nothing in memory for
   * them, so nothing else would ever release them before the expiry.
   */
  releaseDeadLocks?(project: AutoPmProject): Promise<unknown>
  /**
   * Whether an agent this loop started has finished (#852/#1583), and how its handoff ended.
   * Asked before the sweep decides anything, so a run that just ended is closed out first: its
   * routine lock released, a claim it abandoned freed, the rotation's turn earned.
   */
  settled(project: AutoPmProject, agent: { agentId: string }): Promise<SettleOutcome>
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
   * Free a claim this loop minted whose agent settled with nothing to hand off (#1583): the
   * lock's normal release is the agent's own PR deleting it, and a run whose handoff skipped as
   * `no-commits` is never opening one — without this the planning livelocks on the dead claim
   * until a human clicks Release. Keyed off the run's recorded ending, never a timer (#1420).
   * Only the exact minted claim is freed — the callee leaves a lock naming anyone else alone.
   *
   * Resolves `true` when the claim is dealt with (freed, already gone, or someone else's), and
   * `false` when the release could not land — a transient `index.lock`, say — so the loop holds
   * the agent and tries again next sweep rather than losing the one shot. Absent (or throwing)
   * leaves the lock standing, exactly as before this seam.
   */
  releaseLock?(project: AutoPmProject, claim: PlanAssignment): Promise<boolean>
  /** Progress line. */
  log(message: string): void
  /** Override the tick interval. */
  intervalMs?: number
  /** Override the per-project cooldown. */
  cooldownMs?: number
  /** Override {@link DEFAULT_AUTO_PM_HEARTBEAT_MS}. */
  heartbeatMs?: number
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
   * runs with the preference off. It skips the cooldown for the same reason (#1642): the cooldown
   * paces the unattended rotation, and for half an hour after any run it made Run now a button
   * that could start nothing. Every other reason to stand down (live agents, the quota boundary,
   * unticked routines) still holds. A plain on-demand sweep starts the queued work when the branch
   * moved, else the rotation's next job: the click is the ask, so it does not wait for a run to
   * have found nothing.
   *
   * `only` narrows the sweep to one routine's work (#1204), for a Run now on a routine's row:
   *
   * - `'work'` — the queued-work row's Run now means "start an agent on the queue now", whether
   *   or not the daemon saw the branch move; a tick that has nothing queued spends one run finding
   *   that out, which is what the click asked for.
   * - `'plan'` — the one rotation job that fans out ({@link AutoPmJob.fansOut}). Its Run now
   *   used to be a plain single start, so the concurrency setting was the one thing that click
   *   ignored; narrowing here reaches the same claim-then-start path the rotation takes, locks
   *   included.
   * - `{ lock }` — the rotation job holding that lock ({@link AutoPmJob.lock}), for a triage's Run
   *   now (#1643/#1659). One agent, like the rotation's own firing, but through the sweep so the
   *   lock is taken before the start — a plain start would run unguarded.
   *
   * `projectId` scopes the sweep to one project, which is what a Run now fired from a card with a
   * project picked means. Absent, every project the daemon watches is visited, which is what the
   * queued-work row's Run now says it does.
   */
  tick(opts?: { onDemand?: boolean; only?: AutoPmOnly; projectId?: string }): Promise<void>
  /** What the last sweep decided, for the dashboard to show (#1161). */
  report(): AutoPmReport
  stop(): void
}

/**
 * Which routine's work a narrowed sweep is for (#1204/#1643). `'work'` is the queued work
 * (#1774) and `'plan'` the fan-out that writes one ticket's own sibling files per agent. `{ lock }`
 * names a rotation job by the lock it holds ({@link AutoPmJob.lock}): one agent is all it can
 * use, and the lock that guards it is the sweep's to take (#1659) — a Run now that started it
 * outside the sweep would run unguarded. Keyed on the lock rather than the job's name for the same
 * no-name-matching reason the job carries the property at all: the card sends whatever the job
 * it renders declares. A rotation job that neither fans out nor holds a lock has nothing to
 * narrow to — a plain start is exactly what it is.
 */
export type AutoPmOnly = 'work' | 'plan' | { lock: string }

/**
 * Start the auto-PM sweep (#685): every {@link DEFAULT_AUTO_PM_INTERVAL_MS}, look at each
 * project's `agent-data` branch, ask {@link autoPmDecision}, and start an agent for the projects
 * that say yes.
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
  const heartbeatMs = deps.heartbeatMs ?? DEFAULT_AUTO_PM_HEARTBEAT_MS
  const startedAt = now()
  // What the last sweep decided, for `report()`. Undefined only in the moment before the
  // start-up sweep below lands.
  let lastSweep: { enabled: boolean; sweptAt: number; outcomes: AutoPmOutcome[] } | undefined
  // When the rotation last started an agent per project: what the cooldown is measured from.
  const lastStart = new Map<string, number>()
  // The head of each project's `agent-data` branch as this loop last saw it (#1774). Seeded on the
  // first look and never fired on: a daemon that just started knows nothing about what moved
  // while it was down, and the heartbeat is the belt for that.
  const seen = new Map<string, string>()
  // Projects whose branch moved by a commit no daemon wrote since the last start on the queued
  // work. Consumed by that start, and by nothing else: a rotation start leaves it standing.
  const moved = new Set<string>()
  // Projects owed a rotation turn (#1774): the last run this loop started there ended without
  // moving the branch — it found nothing queued — so the queue wants refilling. Also every project
  // on its first look, which is the rotation's start-up turn a daemon has always taken.
  const rotationDue = new Set<string>()
  // When the queued work was last started per project, for the daily heartbeat. Seeded at the
  // first look, so the first heartbeat is a day after the daemon started.
  const lastWork = new Map<string, number>()
  // Runs this loop started that have not settled yet, oldest first. A fanned-out plan agent
  // remembers its ticket (#1327), so while it is still in flight a later tick does not hand the
  // same ticket to a second agent; the claim rides along (#1583) so a run that settles with
  // nothing to hand off gets the lock minted for it released rather than stranded; `waits` counts
  // the sweeps spent holding a finished run whose epilogue has not reported yet, so the hold is
  // bounded.
  type PendingAgent = { agentId: string; ticket?: string; claim?: PlanAssignment; lock?: string; waits?: number }
  const pending = new Map<string, PendingAgent[]>()
  // Tickets whose plan agent ended with nothing to hand off (#1583). Releasing such a claim
  // re-opens the work, and a job that deterministically ends commitless would otherwise respawn
  // every cooldown, forever, burning a quota run per cycle. One attempt per daemon lifetime: a
  // restart forgets the set, which allows one more try rather than forbidding the work for good —
  // a human retires or fixes the ticket in between.
  const endedDry = new Map<string, Set<string>>()
  // Where each project is in the job cycle. Per project, not global: two repos idle at once
  // should each work through the rotation, not take alternate halves of it.
  const nextJob = new Map<string, number>()
  // Projects this loop has swept at least once, for the one-time boot release above.
  const swept = new Set<string>()
  // The last sentence said per project, so a stand-down that holds for a day is logged once, not
  // once a minute: the loop looks every minute now (#1774), and the log is a person's to read.
  const lastSaid = new Map<string, string>()
  let sweeping = false
  let stopped = false

  const tick = async (opts?: { onDemand?: boolean; only?: AutoPmOnly; projectId?: string }): Promise<void> => {
    if (stopped || sweeping) return
    sweeping = true
    let enabled = false
    const outcomes: AutoPmOutcome[] = []
    // Every branch that logs also records, so the panel says exactly what the log says. A start
    // is always logged; a stand-down only when it is news.
    const note = (project: AutoPmProject, started: boolean, message: string) => {
      outcomes.push({ projectId: project.id, path: project.path, started, message })
      if (started) {
        lastSaid.delete(project.id)
        return
      }
      if (lastSaid.get(project.id) === message) return
      lastSaid.set(project.id, message)
      deps.log(`[framework] auto PM: standing down for ${project.path} — ${message}`)
    }
    try {
      // The preference is the cheapest gate and the one the user flips most, so it is read
      // once per sweep rather than per project. An on-demand sweep outranks it — the click is
      // the consent the preference exists to record — but still reads it, so the report says
      // where the box stood.
      enabled = await deps.enabled().catch(() => false)
      if (!enabled && !opts?.onDemand) return
      const all = await deps.projects().catch(() => [])
      // A Run now fired from a card names the project its picker shows; the scheduled sweep names
      // none and visits them all. An id matching nothing leaves an empty list, which stands the
      // sweep down rather than silently widening it to every project.
      const projects = opts?.projectId ? all.filter(project => project.id === opts.projectId) : all
      if (!projects.length) return
      // Read beside the master switch and for the same reason (#1209): it is the same preference
      // file, and a routine switched off mid-sweep should not fire for the projects still to come.
      const optedOut = new Set(await deps.optedOut?.().catch(() => []) ?? [])
      const wanted = (job: AutoPmJob | undefined) => (job && !optedOut.has(job.name) ? job : undefined)
      // The rotation, minus what is switched off. Filtered rather than skipped at the index, so
      // the cycle stays a cycle: with two of four off, the remaining two alternate instead of
      // every other tick landing on a job that cannot run.
      const rotation = deps.jobs.filter(job => !optedOut.has(job.name))
      // How many agents each project may keep going (#1204). Read beside the opt-outs and for the
      // same reason: it is the same preference file, re-read so the setting takes effect
      // mid-schedule. Floored at one, since zero agents is the master switch's job.
      const concurrency = Math.max(
        1,
        Math.floor((await deps.concurrency?.().catch(() => undefined)) ?? DEFAULT_AUTO_PM_CONCURRENCY),
      )
      for (const project of projects) {
        // A previous daemon's routine locks go on this project's first sweep (#1659): their runs
        // are not in `pending`, so nothing below would ever release them.
        if (!swept.has(project.id)) {
          swept.add(project.id)
          await deps.releaseDeadLocks?.(project).catch(() => undefined)
        }
        // The one reading this loop acts on (#1774): the branch's head, against the head it last
        // saw. The first look only remembers it — and owes the rotation its start-up turn, which
        // a daemon has always taken. A later look that finds a commit no daemon wrote is a move.
        const head = await deps.dataHead(project).catch(() => undefined)
        if (head === undefined) {
          note(project, false, 'the agent-data branch could not be read, so there is no way to tell whether anything moved')
          continue
        }
        const was = seen.get(project.id)
        if (was === undefined) {
          seen.set(project.id, head)
          rotationDue.add(project.id)
          lastWork.set(project.id, now())
        } else if (head !== was) {
          seen.set(project.id, head)
          if ((await deps.foreignCommits(project, was, head).catch(() => 0)) > 0) moved.add(project.id)
        }
        // Close out the runs a previous sweep started before deciding: a finished routine's lock
        // is released, a claim its agent abandoned is freed, and a run that ended without moving
        // the branch earns the rotation its turn.
        const outstanding = pending.get(project.id) ?? []
        if (outstanding.length) {
          const stillPending: PendingAgent[] = []
          for (const agent of outstanding) {
            const outcome = await deps.settled(project, agent).catch((): SettleOutcome => ({ settled: false }))
            if (!outcome.settled) {
              stillPending.push(agent)
              continue
            }
            // The run ended cleanly but its epilogue has not reported yet — `end` lands before
            // the handoff event does — and the ending is the one fact the release keys off, so a
            // claim-carrying agent caught in that gap is held a couple more sweeps rather than
            // settled blind. Bounded, so a process that died mid-epilogue cannot hold its claim
            // forever; past the bound it settles unread, which is the pre-#1583 behavior.
            if (agent.claim && outcome.handoffPending && (agent.waits ?? 0) < 2) {
              stillPending.push({ ...agent, waits: (agent.waits ?? 0) + 1 })
              continue
            }
            // A settled run that ended with nothing to hand off is never opening the PR that
            // lifts the lock it was started under (#1583), so the claim minted for it is freed —
            // the one dead claim the sweep can *know* is dead, rather than guess by a timer. A
            // release that could not land is retried next sweep, bounded like the hold above.
            if (agent.claim && outcome.handoffSkip === 'no-commits' && deps.releaseLock) {
              // Remembered before the release, not after: respawning the same work is the hazard
              // whether or not the release lands.
              const dry = endedDry.get(project.id) ?? new Set()
              dry.add(agent.claim.ticket)
              endedDry.set(project.id, dry)
              const ok = await deps.releaseLock(project, agent.claim).catch(() => false)
              if (!ok && (agent.waits ?? 0) < 2) {
                stillPending.push({ ...agent, waits: (agent.waits ?? 0) + 1 })
                continue
              }
            }
            // A routine's lock lifts with its run, whatever the ending (#1659): no PR of the
            // agent's is ever going to. Retried next sweep when the release could not land.
            if (agent.lock && deps.releaseRoutine && !(await deps.releaseRoutine(project, agent.lock).catch(() => false))) {
              if ((agent.waits ?? 0) < 2) stillPending.push({ ...agent, waits: (agent.waits ?? 0) + 1 })
              continue
            }
          }
          if (stillPending.length) pending.set(project.id, stillPending)
          else pending.delete(project.id)
          // The chain's end (#1774): every run this loop started has ended, and none of them
          // moved the branch — the last one found nothing queued. The queue wants refilling, so
          // the rotation gets the next turn. While a run is still going its commits may yet
          // arrive, so the judgement waits for it.
          if (!stillPending.length && !moved.has(project.id)) rotationDue.add(project.id)
        }
        // Per project, because the model the work would run on is (#1619). It costs no reading:
        // the meter is polled elsewhere and this only measures the last one against the boundary.
        const quota = await deps.quota(project).catch(() => undefined)
        const running = deps.activeAgents(project)
        const activeAgents = running.length
        const workJob = wanted(deps.workJob ?? AUTO_PM_WORK_JOB)
        // The planning routine this click asked for, read off the *enabled* rotation so an
        // unticked box stands the click down instead of firing a routine the card shows as off.
        // `fansOut` rather than a name, for the same no-name-matching reason the job carries the
        // property at all.
        const planJob = opts?.only === 'plan' ? rotation.find(item => item.fansOut) : undefined
        if (opts?.only === 'plan' && !planJob) {
          note(project, false, 'the planning routine is switched off')
          continue
        }
        // The locked routine this click asked for (#1643/#1659), by the lock it declares rather
        // than its name, and read off the enabled rotation for the same reason the plan click is.
        // A lock no enabled job holds is told apart: the routine the catalog shows is switched
        // off, which is a setting the user can undo, or nothing holds that lock at all, which is
        // a dashboard older than its daemon.
        const lock = typeof opts?.only === 'object' ? opts.only.lock : undefined
        const lockedJob = lock === undefined ? undefined : rotation.find(item => item.lock === lock)
        if (lock !== undefined && !lockedJob) {
          const off = deps.jobs.find(item => item.lock === lock)
          note(project, false, off ? `${off.label ?? off.name} is switched off` : `no routine holds the ${lock} lock`)
          continue
        }
        // The queued-work row's Run now (#1204/#1774): the click asks for an agent on the queue,
        // and gets that or the reason not.
        if (opts?.only === 'work' && !workJob) {
          note(project, false, 'the routine that works the queue is switched off')
          continue
        }
        // The one routine the click named, when it named one: it takes the tick outright below.
        const named = planJob ?? lockedJob ?? (opts?.only === 'work' ? workJob : undefined)
        /**
         * What this tick does (#1774). The queued work, when the branch moved by a commit no
         * daemon wrote, or when the daily heartbeat is due; else the rotation, when a run found
         * nothing queued (or on the first look, or on a click); else nothing. With the queued-work
         * routine switched off, a move is the rotation's turn instead: #1209 means "do not work
         * the queue", and the rotation does not work it — triage and planning put entries on it.
         * Standing down there would make every inventing routine unreachable for as long as the
         * queue had anything on it (#1432).
         */
        const heartbeat = now() - (lastWork.get(project.id) ?? now()) >= heartbeatMs
        const asked = moved.has(project.id) || heartbeat
        if (asked && !workJob) rotationDue.add(project.id)
        const work = named === undefined && asked && workJob !== undefined
        if (!named && !work && !rotationDue.has(project.id) && !opts?.onDemand) {
          note(project, false, 'nothing moved on the agent-data branch since the last run')
          continue
        }
        // The rotation is paced by the cooldown; a move of the branch and a click are asks, and
        // the queued work is never paced (#1774): the daemon fires again as the run ends.
        const since = lastStart.get(project.id)
        const decision = autoPmDecision({
          enabled: true,
          activeAgents,
          running,
          concurrency,
          quota,
          ...(!work && !named && since !== undefined ? { sinceLastStartMs: now() - since } : {}),
          ...(deps.cooldownMs !== undefined ? { cooldownMs: deps.cooldownMs } : {}),
          ...(opts?.onDemand ? { onDemand: true } : {}),
        })
        if (!decision.start) {
          note(project, false, decision.reason)
          continue
        }
        const index = nextJob.get(project.id) ?? 0
        // A due codebase sweep (#882) outranks the rotation: the rotation invents work, and the
        // sweep is a standing instruction to go find some. Only ever on a rotation turn -- a
        // project whose branch moved has plenty to do, and the sweep would only add more.
        //
        // Asked before the schedule is read, so a switched-off sweep costs no disk read and,
        // more importantly, leaves its calendar untouched: it must come due normally once it is
        // switched back on, rather than having been silently ticked past while it was off.
        const maintenanceJob = wanted(deps.maintenanceJob ?? AUTO_PM_MAINTENANCE_JOB)
        // Never on a click that named a routine: that click takes the tick outright below, so the
        // sweep does not run — and a schedule stamped for a sweep that never ran postpones the
        // real one a whole interval. Asked first, so such a click also costs no schedule read.
        const sweep =
          !named &&
          !work &&
          maintenanceJob !== undefined &&
          (await deps.maintenanceDue?.(project).catch(() => false)) === true
        // The routine a click named outranks both the calendar and the rotation index: it asked for
        // that one, so neither a due codebase sweep nor whose turn it is may take its tick.
        const job = named ?? (work ? workJob : sweep ? maintenanceJob : rotation[index % rotation.length])
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
        // What to start this tick. The queued work is one agent per move (#1774): the agent's own
        // claim moves the branch again, and a cap with room starts the next one alongside it. A
        // rotation job that declares {@link AutoPmJob.fansOut} fans out (#1327): a pinned plan
        // agent writes one ticket's *own* sibling files, so several agents do disjoint work and
        // land disjoint edits. Every other rotation job rewrites the whole queue document from
        // the same fork point, so two at once would revert each other's promotion; those stay one
        // per tick.
        const batch: AutoPmJob[] = [job]
        if (!job.works && job.fansOut && deps.planCandidates && deps.lockPlans) {
          // The fan-out for a rotation job that writes per-ticket files (#1327). Both seams or
          // neither: candidates without locks would fan out unguarded, which is exactly the
          // double-work the locks exist to prevent — so a loop wired without them keeps the
          // stock single agent already in the batch.
          //
          // A ticket an agent still in flight was pinned to is not offered again. The durable
          // half is the lock files themselves: the claim is on disk and pushed, so no meta lookup
          // is needed here.
          const pinned = new Set(
            (pending.get(project.id) ?? []).flatMap(agent => (agent.ticket !== undefined ? [agent.ticket] : [])),
          )
          const candidates = ((await deps.planCandidates(project).catch(() => [])) ?? []).filter(
            // A ticket whose plan agent already ended with nothing to hand off (#1583) is skipped:
            // its released claim respawns the same commitless run forever.
            ticket => !pinned.has(ticket) && !endedDry.get(project.id)?.has(ticket),
          )
          if (!candidates.length) {
            // Nothing left to plan is this job's work being done, not a refusal: the rotation
            // advances, so the next tick tries the next job instead of re-asking forever. A click
            // that named this routine advances nothing — it did not come from the cycle.
            if (!named) nextJob.set(project.id, index + 1)
            note(project, false, 'every open ticket already has a plan, or an agent on the way to one')
            continue
          }
          // Ids are minted here, before the claim (#1748): the lock names the agent that is
          // about to start, and the start is given the same id. From the clock, so a test with
          // an injected clock can predict them.
          const picked = candidates.slice(0, concurrency - activeAgents)
          const ids = mintAgentIds(now(), picked.length)
          const assignments = picked.map((ticket, i) => ({ ticket, agentId: ids[i]! }))
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
        // The rotation's cooldown is armed before the first spawn and once for the whole batch:
        // starting is slow, and a tick that overlapped the spawns would otherwise see too few live
        // agents and top up past the cap. The queued work arms nothing: its next start needs a
        // move of the branch, which is a better guard than a clock.
        if (!job.works) lastStart.set(project.id, now())
        const started: AutoPmJob[] = []
        let standDown: string | undefined
        for (const item of batch) {
          // Re-checked per spawn, for the reason (#983) above: a stop mid-batch must not spawn the rest.
          if (stopped) break
          // A locked routine is taken before its run starts (#1659): an alive lock — another
          // machine's triage, or this one's still going — stands the job down here, with no
          // agent started to find out. Said as its own reason, since nothing was refused.
          if (item.lock && deps.lockRoutine) {
            const taken = await deps.lockRoutine(project, item.lock).catch((): { ok: false; reason: string } => ({ ok: false, reason: 'the routine lock could not be taken' }))
            if (!taken.ok) {
              standDown = taken.reason
              break
            }
          }
          deps.log(`[framework] auto PM: ${doing(item)} in ${project.path}`)
          const agentId = await deps.start(project, item).catch(() => undefined)
          if (!agentId) {
            // The batch ends at the first refusal: whatever refused this start is not going to take
            // the next one a moment later, and a refused job must be retried rather than skipped.
            deps.log(`[framework] auto PM: could not start a run in ${project.path}`)
            // The lock just taken for it goes back: no run will ever release it.
            if (item.lock) await deps.releaseRoutine?.(project, item.lock).catch(() => false)
            break
          }
          started.push(item)
          // Held until a later tick settles it: the ticket it plans stays pinned meanwhile.
          pending.set(project.id, [
            ...(pending.get(project.id) ?? []),
            {
              agentId,
              ...(item.ticket !== undefined ? { ticket: item.ticket } : {}),
              ...(item.claim !== undefined ? { claim: item.claim } : {}),
              ...(item.lock !== undefined ? { lock: item.lock } : {}),
            },
          ])
        }
        // A claim whose agent never started is dead on arrival (#1583): the batch's locks were
        // committed and pushed before the first spawn, so a refused start — or a stop mid-batch —
        // would strand the claims of every item the loop never reached, with no run that could
        // ever settle them free. Released here, not left for the settle loop: these never enter
        // `pending`.
        for (const item of batch) {
          if (item.claim && !started.includes(item)) await deps.releaseLock?.(project, item.claim).catch(() => false)
        }
        if (started.length) {
          if (job.works) {
            // The move is spent (#1774): the next start on the queued work needs the branch to
            // move again — which the agent's own commits do, as the run ends. The rotation's turn
            // is spent too: whether the queue wants refilling is for this run to find out.
            moved.delete(project.id)
            rotationDue.delete(project.id)
            lastWork.set(project.id, now())
          } else {
            // Advanced only on a start that took, so a refused job is retried rather than skipped.
            //
            // A sweep does not advance it, and stamps its own schedule instead: it is paced
            // by the calendar, not the cycle, so borrowing this tick must not cost the rotation its
            // turn. Stamped after the start took for the same reason the rotation is -- a sweep the
            // daemon refused should be retried next tick, not postponed a whole interval.
            // A click that named a routine does not advance it either, for the reason a sweep does
            // not: it borrows the tick for that routine, so the rotation keeps the turn it was on.
            if (sweep) await deps.recordMaintenance?.(project).catch(() => {})
            else if (!named) nextJob.set(project.id, index + 1)
            // The turn the rotation was owed is taken; the next is earned by a run that finds
            // nothing queued, never by a rotation run's own ending.
            rotationDue.delete(project.id)
          }
          // One line per project however many agents went out, and a single start keeps the old
          // wording exactly.
          const described = started.map(item => doing(item)).join('; ')
          // A fan-out that came out short says what it was short by (#1646): a batch of two under
          // a cap of three, with the panel showing nothing running, used to be unexplainable.
          const alongside = running.length ? ` alongside ${running.length} already going (${running.join(', ')})` : ''
          note(
            project,
            true,
            started.length === 1 ? `${described}${alongside}` : `started ${started.length} agents${alongside}: ${described}`,
          )
        } else if (!stopped) {
          // Nothing took, so the cooldown armed above is given back: a batch that started nothing
          // spent nothing, and holding it would strand the project for a whole cooldown.
          lastStart.delete(project.id)
          note(project, false, standDown ?? 'the daemon could not start a run')
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
