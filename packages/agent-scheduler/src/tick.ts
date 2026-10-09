import type { DriverQuota, DriverReadiness } from '@openagt/agent-driver'
import { markerCard, runnerMark, type Publish, type RunnerMark } from '@openagt/agent-runner'
import type { FileBranchWrite } from '@openagt/agent-data'
import type { RunCard } from '@openagt/skill-logs'
import { AGENT_LABELS, AGENT_SKILLS_DIR, DEFAULT_AGENT, LAST_RUN_ENV, NEVER_STARTED_SINCE_MS, NOW_READY_MS, type AgentName } from './names.js'
import type { LastRun } from './records.js'
import { dueFrom, localStamp, paceInForce, paceText } from './pace.js'
import { quotaBoundaryStatus, quotaHeadroom } from './quota-boundary.js'
import { ableAgents, checkFound, commandPrompt, homeAgent, isDue, lastRunValue, ownAttached, skillFile, type Schedule, type ScheduledCommand } from './schedule.js'
import type { StartPoint } from './start-point.js'
import { agentInForce, capInForce, modelInForce, publishInForce, switchedOnAt, type ListedCommand, type State, type TickDecision, type TickRecord } from './state.js'

/**
 * One tick (#1774): pull the branch, sweep, read the schedule, and for each command decide in
 * the cheapest order — can the coding agent run it, is it switched on on this machine, is it due by its pace (this machine's, else its skill's), is its check
 * due, is its cap reached, is its skill where a run's checkout starts, can the coding agent start at all, is there quota — then mark and spawn one run. Every decision is one line in the state, so a
 * dashboard or a person reads why nothing started without a log. A run its check started is handed
 * what the check printed, with its prompt.
 *
 * The quota is read only when everything else says start: a read spawns the agent's CLI and the
 * agent's own usage fetch is refused upstream when asked too often.
 *
 * Two machines can tick the same queue. Each marks before it spawns, then counts again: the
 * marker that landed second past the cap is withdrawn, and that machine does not spawn. A push
 * that fails twice means another machine got there first; no spawn either.
 */

/** What a check said. */
export interface CheckResult {
  ok: boolean
  stdout: string
  stderr: string
}

export interface TickDeps {
  state: State
  schedule: Schedule
  host: string
  now: () => Date
  pull: () => Promise<{ ok: true } | { ok: false; error: string }>
  sweep: () => Promise<unknown>
  /** Where a run's checkout starts, brought up to date, and whether a file is there: a skill that is not is no command to the run's agent. */
  atStart: (file: string) => Promise<StartPoint & { there: boolean }>
  /** Run a check, which reads `lastRun` as `$LAST_RUN`. */
  check: (shell: string, lastRun: string) => Promise<CheckResult>
  /** Whether the command is switched on on this machine as of now: a person may have switched it off, or removed it, since the tick read the state. */
  stillOn: (command: string) => Promise<boolean>
  /** When the command last started on any machine, ISO; nothing when it never did. */
  lastStart: (command: string) => Promise<string | undefined>
  inFlight: (command: string) => Promise<RunCard[]>
  /** Whether a coding agent's CLI can start a session: a missing or logged-out one starts nothing. */
  ready: (agent: AgentName) => Promise<DriverReadiness>
  /** How much of Claude's quota is used: the one agent whose quota can be read. */
  quota: () => Promise<DriverQuota>
  mint: () => string
  writeMarker: (card: RunCard) => Promise<FileBranchWrite>
  withdrawMarker: (id: string) => Promise<unknown>
  /** Start the run's process, detached; resolves once it is spawned. `startedAt` is the start its record keeps, `attached` what the agent is handed with the prompt. */
  spawn: (run: { id: string; prompt: string; startedAt: string; driver: AgentName; model?: string; publish?: Publish; attached?: string }) => Promise<void>
  /** Whether the scheduler was told to stop while this tick runs: then nothing more is started. */
  stopped?: () => boolean
  log?: (line: string) => void
}

export async function tick(deps: TickDeps): Promise<TickRecord> {
  const at = deps.now().toISOString()
  // A schedule that cannot be read is named on every tick, on or off: nothing else says why a skill's commands are missing.
  const unreadable = deps.schedule.unreadable.map(({ skill, reason, own }): TickDecision => ({ command: skill, outcome: `${own ? 'unlisted automation' : 'unreadable schedule'}: ${reason}` }))
  const record: TickRecord = { at, decisions: unreadable, schedule: deps.schedule.commands.map(listed) }
  const pulled = await deps.pull()
  if (pulled.ok) await deps.sweep()
  if (!pulled.ok) return { ...record, note: `agent-data could not be pulled: ${pulled.error}` }
  if (!deps.state.on) return { ...record, note: 'off' }
  if (record.decisions.length === 0 && deps.schedule.commands.length === 0) return { ...record, note: 'no skill of this project schedules a command' }

  const held: Readings = { readiness: {} }
  for (const command of deps.schedule.commands) {
    const { outcome, started } = await decide(deps, command, held)
    record.decisions.push({ command: command.name, outcome, ...(started ? { run: started.id } : {}) })
  }
  return record
}

/** What starting a command by hand answered: the run it started, or the decision that started none, in the tick's own words. */
export type StartedNow = { ok: true; run: LastRun } | { ok: false; outcome: string }

/**
 * Start one run of a command now, because a person asked: whatever its switch on this machine,
 * without waiting for its pace, and whatever quota is left, as for any run a person starts. The
 * rest holds as on a tick: a command with a check starts only when the check finds work, and its
 * run is handed what the check printed; the cap, where a run's checkout starts and whether the
 * coding agent can start are as on a tick. The branch is pulled first, and nothing is swept: the
 * sweep is the scheduler's, and a second sweeper could take a run the scheduler is starting for
 * one that never began.
 *
 * Whoever asked waits for the answer, and a dashboard ends a command that takes too long. So a
 * start that is not ready in time is given up before anything is written: ended after its marker
 * and before its run, the command would leave a record that says running for a run that never was.
 */
export async function startNow(deps: TickDeps, command: ScheduledCommand, clock: () => number = Date.now): Promise<StartedNow> {
  const giveUpAt = clock() + NOW_READY_MS
  const pulled = await deps.pull()
  if (!pulled.ok) return { ok: false, outcome: `agent-data could not be pulled: ${pulled.error}` }
  const decision = await decide(deps, command, { readiness: {} }, { late: () => clock() > giveUpAt })
  return decision.started ? { ok: true, run: decision.started } : { ok: false, outcome: decision.outcome }
}

/** What a tick reads once and holds for every command it decides: each reading spawns the agent's CLI. */
interface Readings {
  /** Per coding agent. */
  readiness: Partial<Record<AgentName, DriverReadiness>>
  /** Claude's usage, the one quota that can be read; the headroom it leaves is worked out per model. */
  quota?: DriverQuota
}

/**
 * Decide one command, and start its run when everything says so: one line, and the run when one
 * started, as the command's last run. `byHand` is a person asking for a run now: the switch, the
 * pace and the quota are not asked, a check asks what is new since a day ago when the command
 * never started and is switched off here, and a start that is `late` by the time it would be
 * written is given up.
 */
async function decide(deps: TickDeps, command: ScheduledCommand, held: Readings, byHand?: { late: () => boolean }): Promise<{ outcome: string; started?: LastRun }> {
  // The coding agent the run would be on, and its model: this machine's picks, else what the command's skill is made for.
  const agent = agentInForce(deps.state, command)
  const model = modelInForce(deps.state, command, agent)
  // An automation kept on this machine is no skill: a run is handed its text, so no folder and no commit has to hold it.
  if (!ableAgents(command).includes(agent)) return { outcome: `not a command of ${AGENT_LABELS[agent]}: its skill is only under ${command.dirs.join(' and ')}, not ${AGENT_SKILLS_DIR[agent]}` }
  const switchedOn = switchedOnAt(deps.state, command.name)
  if (switchedOn === undefined && !byHand) return { outcome: 'switched off on this machine' }
  // When the command is asked about: the start of a run started now. The next check's "since the
  // last start" then begins before this check ran, not the seconds later the run's process began,
  // and nothing that came in between is missed.
  const now = deps.now()
  // The pace in force: this machine's pick, else the skill's; none for a command its check alone paces.
  const pace = byHand ? undefined : paceInForce(deps.state.paces?.[command.name], command)
  const last = pace || command.when !== undefined ? await deps.lastStart(command.name) : undefined
  if (pace) {
    // The pace before the check: the records are on disk already, the check spawns a shell.
    const from = dueFrom(pace, last === undefined ? undefined : new Date(last), now)
    if (now.getTime() < from.getTime()) return { outcome: pace.at ? `not due (next start from ${localStamp(from)}, every ${paceText(pace)})` : `not due (last start ${age(now.getTime() - Date.parse(last!))} ago, every ${paceText(pace)})` }
  }
  // What the check printed, handed to the run it starts: a command its pace alone starts has none.
  let found: { stdout: string; lastRun: string } | undefined
  if (command.when !== undefined) {
    // What is new for the check: since its command last started, or since it was switched on here when that is later.
    const since = lastRunValue(latest(last, switchedOn) ?? new Date(now.getTime() - NEVER_STARTED_SINCE_MS).toISOString())
    const checked = await deps.check(command.when, since).catch((err): CheckResult => ({ ok: false, stdout: '', stderr: String(err) }))
    if (!checked.ok) return { outcome: `check failed: ${checked.stderr.trim().split('\n').at(-1) ?? ''}` }
    if (!isDue(checked.stdout)) return { outcome: 'not due' }
    found = { stdout: checked.stdout, lastRun: since }
  }
  // The cap in force: this machine's number for the command, else the skill's, held against every machine's runs.
  const cap = capInForce(deps.state, command)
  const running = await deps.inFlight(command.name)
  if (running.length >= cap) return { outcome: `cap reached (${running.length} in flight: ${running.map(describe).join(', ')})` }
  // A run's checkout starts from the project's published commit, not from the files here: a skill
  // that is not there is no command to the agent. Asked only now, when a run would start: it fetches.
  if (command.text === undefined) {
    const start = await deps.atStart(skillFile(command, AGENT_SKILLS_DIR[agent]))
    if (!start.there) return { outcome: `not on ${start.ref}${start.reached ? '' : ' as this clone last saw it'}: a run's checkout starts from ${start.ref}, and the command's skill is not there` }
  }
  // Both read once per tick, and only now: each spawns the agent's CLI.
  const readiness = (held.readiness[agent] ??= await deps.ready(agent))
  if (readiness.problems.length > 0) return { outcome: `not ready: ${readiness.problems.join(' ')}` }
  if (!byHand) {
    // Only Claude's quota can be read: a run on any other agent starts without the question, and that agent says so itself when it has none left.
    if (agent === 'claude-code') {
      held.quota ??= await deps.quota().catch((): DriverQuota => ({ available: false, reason: 'fetch-failed' }))
      const headroom = quotaHeadroom(held.quota.available ? quotaBoundaryStatus({ windows: held.quota.windows, now: deps.now().getTime(), ...(model !== undefined ? { model } : {}), limitOffset: deps.state.spendOffset }) : undefined)
      if (!headroom.start) return { outcome: `quota: ${headroom.reason}` }
    }
    // The stop may have come in during the readings above: a stopped scheduler starts nothing.
    if (deps.stopped?.()) return { outcome: 'not started: the scheduler was stopped' }
    // So may a person's switch: the check and the readings take seconds, and a command switched off or removed meanwhile starts nothing.
    if (!(await deps.stillOn(command.name))) return { outcome: 'switched off on this machine' }
  }
  if (byHand?.late()) return { outcome: `took longer than ${NOW_READY_MS / 1000} seconds to get ready, so nothing was started: ask again` }
  const id = deps.mint()
  const prompt = commandPrompt(command)
  // A skill's run is handed what its check found; an automation kept on this machine, its text first.
  const attached = command.text !== undefined ? ownAttached(command.text, found) : found ? checkFound(found.stdout, found.lastRun) : undefined
  // The publish level in force, this machine's pick, goes on the marker and to the run: the agent is told it after its prompt.
  const level = publishInForce(deps.state, command.name)
  const publish = level !== undefined ? { publish: level } : {}
  const mark: RunnerMark = { host: deps.host, ...publish }
  const marked = await deps.writeMarker(markerCard({ id, startedAt: now.toISOString(), prompt, driver: agent, ...(model !== undefined ? { model } : {}), mark }))
  if (!marked.ok) {
    // The commit stayed local and would ride a later push: taken back, so no record says running for a run that never was.
    await deps.withdrawMarker(id)
    return { outcome: `another machine got there first: ${marked.error}` }
  }
  // Both machines' markers may have landed. The cap is the first `cap` ids in time order;
  // a marker ranked past it is withdrawn by the machine that wrote it.
  const after = await deps.inFlight(command.name)
  const rank = after.map(card => card.id).sort().indexOf(id)
  if (rank < 0) {
    // The marker is no longer a running one: another process of this machine swept it, as a run that never began, before this one started it.
    await deps.withdrawMarker(id)
    return { outcome: 'not started: its record was closed before the run began' }
  }
  if (rank >= cap) {
    await deps.withdrawMarker(id)
    const others = after.filter(c => c.id !== id)
    return { outcome: `cap reached (${others.length} in flight: ${others.map(describe).join(', ')})` }
  }
  try {
    await deps.spawn({ id, prompt, startedAt: now.toISOString(), driver: agent, ...(model !== undefined ? { model } : {}), ...publish, ...(attached !== undefined ? { attached } : {}) })
    return { outcome: `started ${id}`, started: { id, at: now.toISOString() } }
  } catch (err) {
    // No record says running for a run that never was.
    await deps.withdrawMarker(id)
    return { outcome: `could not start: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/** The later of two times, either of which may be missing; nothing when both are. */
function latest(a: string | undefined, b: string | undefined): string | undefined {
  if (a === undefined || b === undefined) return a ?? b
  return Date.parse(a) > Date.parse(b) ? a : b
}

/** A command as a dashboard lists it: what its skill says; not this machine's switch or picks, which the state carries, nor its runs, which the records do. */
export function listed(command: ScheduledCommand): ListedCommand {
  return { command: command.name, ...(command.every ? { every: command.every.text } : {}), ...(command.when !== undefined ? { when: command.when } : {}), ...(command.waitsFor !== undefined ? { waitsFor: command.waitsFor } : {}), ...(command.description !== undefined ? { description: command.description } : {}), ...(command.cap > 1 ? { agents: command.cap } : {}), ...(command.text !== undefined ? { onThisMachine: true as const } : {}), ...(command.editable ? { editable: true as const } : {}), agent: homeAgent(command), ...(command.model !== undefined ? { model: command.model, modelAgent: command.agent ?? DEFAULT_AGENT } : {}), able: ableAgents(command) }
}

/** An age for a decision line: `less than a minute`, `12m`, `3h`, `2d`, floored. */
function age(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'less than a minute'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function describe(card: RunCard): string {
  const host = runnerMark(card)?.host
  return host ? `${card.id} on ${host}` : card.id
}

/** Run a check at the repository root through the shell, within its budget; the check reads `lastRun` as `$LAST_RUN`. */
export async function runCheck(repo: string, shell: string, timeoutMs: number, lastRun: string): Promise<CheckResult> {
  const { execFile } = await import('node:child_process')
  return new Promise<CheckResult>(resolve => {
    const child = execFile('sh', ['-c', shell], { cwd: repo, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, [LAST_RUN_ENV]: lastRun } }, (err, stdout, stderr) => {
      // A check ended for running out of its time says so: what it had printed to then says nothing of why it failed.
      const why = err?.killed ? `it took longer than ${timeoutMs / 1000} seconds` : err && !String(stderr).trim() ? err.message : String(stderr)
      resolve({ ok: !err, stdout: String(stdout), stderr: why })
    })
    // Nobody types to a check: one that reads its input finds it at its end at once, where it would wait out its whole budget.
    child.stdin?.end()
  })
}

export type { TickDecision }
