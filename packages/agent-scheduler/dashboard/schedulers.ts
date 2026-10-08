import type { ModuleHost, ModuleProject } from '@openagt/dashboard/module'
import type { PublishPick, TickDecision } from '../src/state.js'
import { DEFAULT_PUBLISH, isAgents, isTime } from '../src/names.js'
import { MAX_COUNT, paceInForce, parseInterval, parseTimeOfDay, takesTimeOfDay, type PacePick, type PaceUnit } from '../src/pace.js'

// What the module shows of each project's scheduler: the answer of `agent-scheduler status`, the
// state file as it stands plus whether the scheduler's process is alive. Forgiving: a field that is
// not what the command promises reads as absent, and a project whose command fails is a row that
// says why.

/** The publish picks a person can make for a scheduled command, in the menu's order, with their labels. */
export const PUBLISH_LABELS: Readonly<Record<PublishPick, string>> = {
  nothing: 'Nothing',
  commit: 'Commit',
  branch: 'Publish branch',
  pr: 'Open PR',
  merge: 'Merge on green',
}

const PUBLISH_PICKS = Object.keys(PUBLISH_LABELS) as PublishPick[]

/** How far the spend offset reaches either side of the quota boundary, in percentage points: the reach of the usage bar's handle. */
import { MAX_SPEND_OFFSET } from '@openagt/dashboard/module'
export { MAX_SPEND_OFFSET }

/** One command the project's skills schedule, as the scheduler's last tick read it, with this machine's switch and publish pick. */
export interface SchedulerCommand {
  command: string
  /** How often at most, as written (`1d`). */
  every?: string
  /** The check, when the skill gives one. */
  when?: string
  /** What the check waits for, in one plain line, when the skill gives one. */
  waitsFor?: string
  /** Whether it runs on this machine: off until a person switched it on here. */
  on: boolean
  /** How far a run of the command publishes on this machine: the pick made here, commit until one is made. */
  publish: PublishPick
  /** This machine's pace for the command, where a person set one: it stands in for the skill's interval. */
  pace?: PacePick
  /** How many runs of the command its skill lets be in flight at once, when it is more than one. */
  skillAgents?: number
  /** This machine's number of runs of the command in flight at once, where a person set one: it stands in for the skill's. */
  agents?: number
  /** What the command's skill does, in the skill's own words, when it says. */
  description?: string
  /** What the scheduler's last tick decided for the command, when it decided anything. */
  decision?: TickDecision
}

/** A skill of the project whose `schedule` the scheduler could not read, with why: its commands are missing from the list. */
export interface UnreadableSchedule {
  skill: string
  reason: string
}

/** One project's scheduler, as its `status` answered. */
export interface SchedulerRow {
  project: ModuleProject
  /** Why the status could not be read; the rest is then empty. */
  error?: string
  /** Whether ticks start agents. */
  on: boolean
  /** Whether the scheduler's process outlives the dashboard that started it. */
  keepAlive: boolean
  /** Whether the scheduler's own process is alive on this machine. */
  running: boolean
  /** The model every scheduled run starts on. */
  model?: string
  /** How far past the quota boundary the project's scheduled runs may still start, in percentage points. */
  spendOffset?: number
  lastTick?: { at: string; decisions: TickDecision[]; note?: string }
  /** The scheduled commands; empty until the scheduler has ticked once, and where no skill of the project schedules one. */
  commands: SchedulerCommand[]
  /** The skills whose `schedule` the last tick could not read. */
  unreadable: UnreadableSchedule[]
}

function isPick(value: unknown): value is PublishPick {
  return (PUBLISH_PICKS as unknown[]).includes(value)
}

/** Whether a value of the state reads as a pace a person set: "whenever there is work", or an interval the tool reads. */
function isPace(value: unknown): boolean {
  // The same two readings as the tool's own (`paceInForce`): anything else is no pace, and the row says its skill's.
  const pick = record(value)
  return pick['work'] === true || (typeof pick['every'] === 'string' && parseInterval(pick['every']) !== undefined)
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** What a tick says of a skill whose `schedule` it could not read, before the reason. */
const UNREADABLE = 'unreadable schedule: '

/** A project's row from what `status` printed: each scheduled command with this machine's switch and publish pick and the last tick's decision folded in, and the skills the tick could not read. */
export function schedulerRow(project: ModuleProject, output: unknown): SchedulerRow {
  const state = record(output)
  const tick = record(state['lastTick'])
  const switches = record(state['switches'])
  const publishes = record(state['publishes'])
  const paces = record(state['paces'])
  const agents = record(state['agents'])
  const decisions: TickDecision[] = []
  for (const item of Array.isArray(tick['decisions']) ? (tick['decisions'] as unknown[]) : []) {
    const d = record(item)
    if (typeof d['command'] !== 'string' || typeof d['outcome'] !== 'string') continue
    decisions.push({ command: d['command'], outcome: d['outcome'], ...(typeof d['run'] === 'string' ? { run: d['run'] } : {}) })
  }
  const commands: SchedulerCommand[] = []
  for (const item of Array.isArray(tick['schedule']) ? (tick['schedule'] as unknown[]) : []) {
    const row = record(item)
    const command = row['command']
    if (typeof command !== 'string') continue
    const picked = publishes[command]
    const decision = decisions.find(d => d.command === command)
    commands.push({
      command,
      ...(typeof row['every'] === 'string' ? { every: row['every'] } : {}),
      ...(typeof row['when'] === 'string' ? { when: row['when'] } : {}),
      ...(typeof row['waitsFor'] === 'string' ? { waitsFor: row['waitsFor'] } : {}),
      on: isTime(switches[command]),
      publish: isPick(picked) ? picked : DEFAULT_PUBLISH,
      ...(isPace(paces[command]) ? { pace: paces[command] as PacePick } : {}),
      ...(isAgents(row['agents']) && row['agents'] > 1 ? { skillAgents: row['agents'] } : {}),
      ...(isAgents(agents[command]) ? { agents: agents[command] } : {}),
      ...(typeof row['description'] === 'string' ? { description: row['description'] } : {}),
      ...(decision ? { decision } : {}),
    })
  }
  const offset = state['spendOffset']
  return {
    project,
    on: state['on'] === true,
    keepAlive: state['keepAlive'] === true,
    running: state['running'] === true,
    ...(typeof state['model'] === 'string' ? { model: state['model'] } : {}),
    ...(typeof offset === 'number' && Number.isFinite(offset) ? { spendOffset: offset } : {}),
    ...(typeof tick['at'] === 'string' ? { lastTick: { at: tick['at'], decisions, ...(typeof tick['note'] === 'string' ? { note: tick['note'] } : {}) } } : {}),
    commands,
    unreadable: decisions.flatMap(d => (d.outcome.startsWith(UNREADABLE) ? [{ skill: d.command, reason: d.outcome.slice(UNREADABLE.length) }] : [])),
  }
}

/** Every project's scheduler, one row per project in the order given: `agent-scheduler status` run in each. */
export function readSchedulers(host: ModuleHost, projects: readonly ModuleProject[]): Promise<SchedulerRow[]> {
  return Promise.all(
    projects.map(async project => {
      const answer = await host.runCommand(project.id, ['status'])
      return answer.ok ? schedulerRow(project, answer.output) : { project, error: answer.error, on: false, keepAlive: false, running: false, commands: [], unreadable: [] }
    }),
  )
}

/**
 * The spend offset in force across the projects: the loosest one, since it is the one that lets
 * scheduled work spend the furthest; `undefined` when no project answered one. A save writes every
 * project, so the schedulers agree unless one was set by hand.
 */
export function loosestSpendOffset(rows: readonly SchedulerRow[]): number | undefined {
  const offsets = rows.flatMap(row => (row.spendOffset !== undefined ? [row.spendOffset] : []))
  return offsets.length ? Math.max(...offsets) : undefined
}

/** The projects whose spend offset is not the one in force (the loosest), each with its own, to one decimal: what a save would bring into line. */
export function offsetsThatDiffer(rows: readonly SchedulerRow[]): { name: string; offset: number }[] {
  const loosest = loosestSpendOffset(rows)
  return rows.flatMap(row => (row.spendOffset !== undefined && row.spendOffset !== loosest ? [{ name: row.project.name, offset: Math.round(row.spendOffset * 10) / 10 }] : []))
}

/** The spend offset a typed text means: a whole number of points held to the reach of the usage bar's handle; `undefined` while the text is no number yet (empty, a minus sign alone). */
export function typedOffset(raw: string): number | undefined {
  if (raw.trim() === '' || !Number.isFinite(Number(raw))) return undefined
  return Math.min(Math.max(Math.round(Number(raw)), -MAX_SPEND_OFFSET), MAX_SPEND_OFFSET)
}

export type Saved = { ok: true } | { ok: false; error: string }

/** Save the spend offset in every project: `agent-scheduler offset -- <points>`, the `--` so a negative value is no flag. Each failing project is named. */
export async function saveSpendOffset(host: ModuleHost, projects: readonly ModuleProject[], points: number): Promise<Saved> {
  const answers = await Promise.all(projects.map(async project => ({ project, answer: await host.runCommand(project.id, ['offset', '--', String(points)]) })))
  const failed = answers.flatMap(({ project, answer }) => (answer.ok ? [] : [`${project.name}: ${answer.error}`]))
  return failed.length ? { ok: false, error: failed.join('; ') } : { ok: true }
}

/** The picks a scheduled command's publish menu lists: every one where the project has a git host package, else Nothing, Commit and Publish branch, since no pull request can be opened; and the pick in force when the project is not offered it. */
export function publishChoices(gitHost: boolean, saved: PublishPick): readonly PublishPick[] {
  const offered: readonly PublishPick[] = gitHost ? PUBLISH_PICKS : ['nothing', 'commit', 'branch']
  return offered.includes(saved) ? offered : [...offered, saved]
}

/** A unit's word on the page, in the order the menu lists them. */
export const UNIT_WORDS: Readonly<Record<PaceUnit, string>> = { m: 'minute', h: 'hour', d: 'day', w: 'week', mo: 'month' }

/** An interval as written, spelled out: `15m` is "15 minutes", `1h` is "1 hour", `2w` is "2 weeks". One the tool would not have read is shown as written. */
export function spelled(every: string): string {
  const read = parseInterval(every)
  return read ? `${read.count} ${UNIT_WORDS[read.unit]}${read.count === 1 ? '' : 's'}` : every
}

const sentence = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * How often a scheduled command runs, as a sentence, by the pace in force: this machine's, else
 * its skill's. An interval is "Every 6 hours", with "at most" before what its check waits for
 * when it has a check; a time of day is "Every 2 days at 10:00"; a command its check alone paces
 * says what the check waits for. A check whose skill gives no plain line is "when its check finds
 * work". Beside a check a time of day is "from 10:00": the command starts once the check finds
 * work, which may be later that day.
 */
export function pace(command: SchedulerCommand): string {
  const waits = command.waitsFor ?? 'when its check finds work'
  const skills = command.every === undefined ? undefined : parseInterval(command.every)
  const inForce = paceInForce(command.pace, { ...(skills ? { every: skills } : {}), ...(command.when !== undefined ? { when: command.when } : {}) })
  // An interval of the skill's the tool would not have read is shown as written.
  const every = inForce ? spelled(inForce.every.text) : command.pace === undefined && command.every !== undefined ? command.every : undefined
  if (every === undefined) return sentence(waits)
  if (command.when === undefined) return inForce?.at ? `Every ${every} at ${inForce.at.text}` : `Every ${every}`
  return inForce?.at ? `Every ${every} from ${inForce.at.text}, ${waits}` : `Every ${every} at most, ${waits}`
}

/** Whether the pace a command runs at is one a person set on this machine, not its skill's. */
export function ownPace(command: SchedulerCommand): boolean {
  return draftOf(command).kind !== 'skill'
}

/**
 * A pace as the Edit box holds it while a person picks: the skill's own, whenever there is work,
 * or an interval typed as a count and a unit with an optional time of day. The count and the time
 * are text, as typed, so a half-typed one is no pace yet. A time field left half typed reports no
 * text at all, so the draft holds that it is half typed beside it.
 */
export type PaceDraft = { kind: 'skill' } | { kind: 'work' } | { kind: 'every'; count: string; unit: PaceUnit; at: string; atHalfTyped?: true }

/** The draft a command's Edit box opens with: its pace on this machine, the skill's own where nobody set one or the one set cannot be followed. */
export function draftOf(command: SchedulerCommand): PaceDraft {
  const pick = command.pace
  if (pick === undefined) return { kind: 'skill' }
  // "Whenever there is work" is what a skill with a check and no interval says already.
  if ('work' in pick && pick.work === true) return command.when !== undefined && command.every !== undefined ? { kind: 'work' } : { kind: 'skill' }
  const every = 'every' in pick ? parseInterval(pick.every) : undefined
  if (!every || !('every' in pick)) return { kind: 'skill' }
  const at = takesTimeOfDay(every) && pick.at !== undefined ? parseTimeOfDay(pick.at) : undefined
  return { kind: 'every', count: String(every.count), unit: every.unit, at: at?.text ?? '' }
}

/**
 * What a draft is on the command line, after `pace <command>`: `skill`, `work`, or an interval
 * with its time of day when it has one. Nothing while the draft is no pace yet: a count that is
 * no whole number above 0, a time that is none. A time typed beside minutes or hours is left out,
 * since the page hides the field then.
 */
export function paceArgs(draft: PaceDraft): string[] | undefined {
  if (draft.kind !== 'every') return [draft.kind]
  const every = /^\d+$/.test(draft.count.trim()) ? parseInterval(`${draft.count.trim()}${draft.unit}`) : undefined
  if (!every) return undefined
  if (!takesTimeOfDay(every)) return [every.text]
  if (draft.atHalfTyped) return undefined
  if (draft.at.trim() === '') return [every.text]
  const at = parseTimeOfDay(draft.at.trim())
  return at ? [every.text, at.text] : undefined
}

/** What keeps a draft from being a pace yet, for the person typing it; nothing when it is one. */
export function paceProblem(draft: PaceDraft): string | undefined {
  if (paceArgs(draft)) return undefined
  if (draft.kind === 'every' && !(/^\d+$/.test(draft.count.trim()) && parseInterval(`${draft.count.trim()}${draft.unit}`))) return `Type a whole number, from 1 to ${MAX_COUNT}.`
  return 'Finish the time, like 10:00, or clear it.'
}

/** A command as it would read with a draft saved: what the Edit box's sentence describes. The command as it is while the draft is no pace yet. */
export function withDraft(command: SchedulerCommand, draft: PaceDraft): SchedulerCommand {
  const args = paceArgs(draft)
  if (!args) return command
  const { pace: _pace, ...rest } = command
  if (args[0] === 'skill') return rest
  return { ...rest, pace: args[0] === 'work' ? { work: true } : { every: args[0]!, ...(args[1] !== undefined ? { at: args[1] } : {}), since: '' } }
}

/** How many runs of a scheduled command may be in flight at once, as this machine counts: the number set here, else the skill's, one when it says none. */
export function atOnce(command: SchedulerCommand): number {
  return command.agents ?? command.skillAgents ?? 1
}

/** Whether a command's number of agents at once is worth saying: when it is more than one, or a person set it, even to one. */
export function saysAtOnce(command: SchedulerCommand): boolean {
  return atOnce(command) > 1 || command.agents !== undefined
}

/** A number of agents at once, as a sentence: "One at a time", "Up to 3 at once". */
export function atOnceWords(count: number): string {
  return count === 1 ? 'One at a time' : `Up to ${count} at once`
}

/** A number of agents at once as the Edit box holds it while a person picks: the skill's own, or a count as typed. */
export type AgentsDraft = { kind: 'skill' } | { kind: 'own'; count: string }

/** The draft a command's Edit box opens with: its number on this machine, the skill's own where nobody set one. */
export function agentsDraftOf(command: SchedulerCommand): AgentsDraft {
  return command.agents === undefined ? { kind: 'skill' } : { kind: 'own', count: String(command.agents) }
}

/** What a draft is on the command line, after `agents <command>`: `skill`, or the count. Nothing while the count is no whole number from 1 to 99. */
export function agentsArgs(draft: AgentsDraft): string[] | undefined {
  if (draft.kind === 'skill') return ['skill']
  const typed = draft.count.trim()
  return /^\d+$/.test(typed) && isAgents(Number(typed)) ? [String(Number(typed))] : undefined
}

/** A command as it would read with a number of agents draft saved; the command as it is while the draft is no number yet. */
export function withAgentsDraft(command: SchedulerCommand, draft: AgentsDraft): SchedulerCommand {
  const args = agentsArgs(draft)
  if (!args) return command
  const { agents: _agents, ...rest } = command
  return args[0] === 'skill' ? rest : { ...rest, agents: Number(args[0]) }
}

/** How far a scheduled command's runs publish on this machine, as a sentence. */
export function publishes(command: SchedulerCommand): string {
  if (command.publish === 'commit') return 'Commits its work'
  if (command.publish === 'branch') return 'Publishes its branch'
  if (command.publish === 'pr') return 'Opens a pull request'
  if (command.publish === 'merge') return 'Opens a pull request that merges on green'
  return 'Publishes nothing'
}

/**
 * What the scheduler last decided for a scheduled command, for a person. A command the coding
 * agent cannot run says so whatever its switch: switching it on would start nothing. Then "Off"
 * for a command switched off here, and nothing for one switched on that no tick has decided yet.
 * A decision is said in plain words where the tool's own are a rule's shorthand ("No work", "One
 * is already running"), and in the tool's words with a capital where they carry a reason only the
 * tool knows (`Quota: …`, `Check failed: …`). A command waiting for its time of day says when it
 * is next due: "Next: Saturday 10:00".
 */
export function decided(command: SchedulerCommand, now: Date = new Date()): string | undefined {
  const outcome = command.decision?.outcome
  const elsewhere = /^not a command of the coding agent: its skill is only under (\S+),/.exec(outcome ?? '')
  if (elsewhere) return `Cannot start: its skill is only in ${elsewhere[1]}, which Claude Code does not read`
  if (!command.on) return 'Off'
  if (outcome === undefined || outcome === 'switched off on this machine') return undefined
  if (outcome === 'not due') return 'No work'
  if (outcome.startsWith('started ')) return 'Started a run'
  const paced = /^not due \(last start (.+) ago, /.exec(outcome)
  if (paced) return `Started ${paced[1]} ago, not due yet`
  const next = /^not due \(next start from (\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d),/.exec(outcome)
  if (next) return `Next: ${nextWords(new Date(Number(next[1]), Number(next[2]) - 1, Number(next[3]), Number(next[4]), Number(next[5])), now)}`
  const capped = /^cap reached \((\d+) in flight/.exec(outcome)
  if (capped) return capped[1] === '1' ? 'One is already running' : `${capped[1]} are already running`
  return sentence(outcome)
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A coming local time, for a person: "today 10:00", "tomorrow 10:00", the weekday within a week ("Saturday 10:00"), else the date ("24 Oct 10:00"). A time already past, read off an old tick, is "as soon as the scheduler looks". */
export function nextWords(when: Date, now: Date): string {
  const two = (n: number): string => String(n).padStart(2, '0')
  if (when.getTime() <= now.getTime()) return 'as soon as the scheduler looks'
  const time = `${two(when.getHours())}:${two(when.getMinutes())}`
  const days = Math.round((new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000)
  if (days === 0) return `today ${time}`
  if (days === 1) return `tomorrow ${time}`
  if (days > 1 && days < 7) return `${WEEKDAYS[when.getDay()]} ${time}`
  return `${when.getDate()} ${MONTHS[when.getMonth()]} ${time}`
}

/** The one word a scheduler's row leads with, and its colour. */
export function schedulerStatus(row: Pick<SchedulerRow, 'error' | 'on' | 'running'>): { label: string; tone: string } {
  if (row.error !== undefined) return { label: 'not readable', tone: 'text-danger' }
  if (!row.on) return { label: 'off', tone: 'text-muted-foreground' }
  if (!row.running) return { label: 'on, not running', tone: 'text-warning' }
  return { label: 'on', tone: 'text-success' }
}
