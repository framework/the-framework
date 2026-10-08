import { describe, expect, test } from 'vitest'
import { STATUS, hostAnswering } from './fixtures.js'
import { decided, draftOf, loosestSpendOffset, nextWords, offsetsThatDiffer, ownPace, pace, paceArgs, publishChoices, publishes, readSchedulers, saveSpendOffset, schedulerRow, schedulerStatus, spelled, typedOffset, withDraft } from './schedulers.js'

const GEMSTACK = { id: 'p1', name: 'gemstack', gitHost: true }
const OTHER = { id: 'p2', name: 'other', gitHost: false }

describe('a scheduler row, from what status printed', () => {
  test("each scheduled command carries this machine's switch and publish pick, off until switched on here and commit until picked here, what its skill says it does, and the last tick's decision for it", () => {
    const row = schedulerRow(GEMSTACK, STATUS)
    expect(row).toMatchObject({ project: GEMSTACK, on: true, keepAlive: false, running: true, model: 'opus', spendOffset: 7, unreadable: [] })
    expect(row.commands).toEqual([
      // Switched on here; nobody picked a level.
      { command: 'post-merge-cleanup', every: '1d', on: true, publish: 'commit', description: 'Write up merged pull requests.', decision: STATUS.lastTick.decisions[0] },
      // Nobody switched it on here; the pick made here is nothing.
      { command: 'work-queue', when: 'npx queue', waitsFor: 'when the queue holds a task', on: false, publish: 'nothing', description: 'Work one queued task.', decision: STATUS.lastTick.decisions[1] },
    ])
    expect(row.lastTick).toEqual({ at: '2026-10-03T10:00:00.000Z', decisions: STATUS.lastTick.decisions })
  })

  test("a scheduled command carries the pace a person set for it on this machine", () => {
    const since = '2026-10-08T07:00:00.000Z'
    const row = schedulerRow(GEMSTACK, { ...STATUS, paces: { 'post-merge-cleanup': { every: '2d', at: '10:00', since }, 'work-queue': { work: true }, gone: { every: '1h', since } } })
    expect(row.commands.map(c => [c.command, c.pace])).toEqual([['post-merge-cleanup', { every: '2d', at: '10:00', since }], ['work-queue', { work: true }]])
  })

  test("a skill whose schedule the tick could not read is named with the reason, and is no command's decision", () => {
    const row = schedulerRow(GEMSTACK, {
      ...STATUS,
      lastTick: { ...STATUS.lastTick, decisions: [{ command: 'triage', outcome: 'unreadable schedule: row 2: unknown key evry' }, ...STATUS.lastTick.decisions] },
    })
    expect(row.unreadable).toEqual([{ skill: 'triage', reason: 'row 2: unknown key evry' }])
    expect(row.commands.map(c => c.decision?.outcome)).toEqual(['started 2026-10-03T10-00-00-000Z', 'switched off on this machine'])
  })

  test('a scheduler that never ticked lists no command; a field that is not what the command promises reads as absent', () => {
    expect(schedulerRow(GEMSTACK, { ok: true, on: false, keepAlive: false, model: 'opus', spendOffset: 7.14, running: false })).toEqual({ project: GEMSTACK, on: false, keepAlive: false, running: false, model: 'opus', spendOffset: 7.14, commands: [], unreadable: [] })
    const odd = schedulerRow(GEMSTACK, {
      on: 'yes',
      spendOffset: 'far',
      model: 3,
      switches: { a: 'yes' },
      publishes: { a: 'push' },
      paces: { a: { every: 'often' } },
      lastTick: { at: '2026-10-03T10:00:00.000Z', note: 'off', decisions: [{ command: 'a' }, 'x'], schedule: [{ command: 'a', every: 6, waitsFor: ['x'], description: 7 }, { every: '1d' }, null] },
    })
    expect(odd).toEqual({ project: GEMSTACK, on: false, keepAlive: false, running: false, lastTick: { at: '2026-10-03T10:00:00.000Z', decisions: [], note: 'off' }, commands: [{ command: 'a', on: false, publish: 'commit' }], unreadable: [] })
    expect(schedulerRow(GEMSTACK, null).commands).toEqual([])
  })
})

describe('reading and saving through the command', () => {
  test('status runs in every project; a project whose command fails is a row that says why', async () => {
    const { host, runCommand } = hostAnswering(projectId => (projectId === 'p1' ? { ok: true, output: STATUS } : { ok: false, error: 'not inside a git repository' }))
    const rows = await readSchedulers(host, [GEMSTACK, OTHER])
    expect(runCommand.mock.calls).toEqual([['p1', ['status']], ['p2', ['status']]])
    expect(rows[0]!.commands).toHaveLength(2)
    expect(rows[1]).toEqual({ project: OTHER, error: 'not inside a git repository', on: false, keepAlive: false, running: false, commands: [], unreadable: [] })
    expect(schedulerStatus(rows[1]!).label).toBe('not readable')
  })

  test('the offset in force is the loosest one; none when no project answered one', () => {
    const row = (spendOffset?: number) => ({ ...schedulerRow(GEMSTACK, {}), ...(spendOffset !== undefined ? { spendOffset } : {}) })
    expect(loosestSpendOffset([row(-5), row(12), row()])).toBe(12)
    expect(loosestSpendOffset([row(), row()])).toBeUndefined()
    expect(loosestSpendOffset([])).toBeUndefined()
  })

  test('the projects whose offset is not the one in force are named with their own; none when they agree or did not answer', () => {
    const row = (name: string, spendOffset?: number) => ({ ...schedulerRow({ id: name, name, gitHost: true }, {}), ...(spendOffset !== undefined ? { spendOffset } : {}) })
    expect(offsetsThatDiffer([row('a', 12), row('b', -5.04), row('c'), row('d', 12)])).toEqual([{ name: 'b', offset: -5 }])
    expect(offsetsThatDiffer([row('a', 4), row('b', 4)])).toEqual([])
    expect(offsetsThatDiffer([row('a')])).toEqual([])
  })

  test('a typed offset is a whole number held to the reach of the bar; text that is no number yet is none', () => {
    expect(typedOffset('7.6')).toBe(8)
    expect(typedOffset('-200')).toBe(-50)
    expect(typedOffset('200')).toBe(50)
    expect(typedOffset('0')).toBe(0)
    expect(typedOffset('-')).toBeUndefined()
    expect(typedOffset(' ')).toBeUndefined()
    expect(typedOffset('')).toBeUndefined()
  })

  test('the offset is saved in every project, a negative one after `--`; each failing project is named', async () => {
    const { host, runCommand } = hostAnswering(projectId => (projectId === 'p2' ? { ok: false, error: 'exit 2' } : { ok: true, output: { ok: true } }))
    expect(await saveSpendOffset(host, [GEMSTACK], -12.5)).toEqual({ ok: true })
    expect(runCommand).toHaveBeenLastCalledWith('p1', ['offset', '--', '-12.5'])
    expect(await saveSpendOffset(host, [GEMSTACK, OTHER], 3)).toEqual({ ok: false, error: 'other: exit 2' })
  })
})

describe('in words', () => {
  test('the status a row leads with: off, on but not running, on', () => {
    const row = schedulerRow(GEMSTACK, STATUS)
    expect(schedulerStatus(row)).toEqual({ label: 'on', tone: 'text-success' })
    expect(schedulerStatus({ ...row, running: false }).label).toBe('on, not running')
    expect(schedulerStatus({ ...row, on: false }).label).toBe('off')
  })

  test('the pace, as a sentence: an interval spelled out, what the check waits for, or both; a check with no plain line is "when its check finds work"', () => {
    const base = { command: 'a', on: true, publish: 'commit' as const }
    expect(pace({ ...base, every: '1d' })).toBe('Every 1 day')
    expect(pace({ ...base, when: 'npx queue' })).toBe('When its check finds work')
    expect(pace({ ...base, when: 'npx queue', waitsFor: 'when the queue holds a task' })).toBe('When the queue holds a task')
    expect(pace({ ...base, every: '6h', when: 'x' })).toBe('Every 6 hours at most, when its check finds work')
    expect(pace({ ...base, every: '15m', when: 'x', waitsFor: 'when a ticket has no plan' })).toBe('Every 15 minutes at most, when a ticket has no plan')
    expect([spelled('1m'), spelled('1h'), spelled('7d'), spelled('2w'), spelled('1mo'), spelled('soon'), spelled('0d'), spelled('d'), spelled('-3h'), spelled('06h')]).toEqual(['1 minute', '1 hour', '7 days', '2 weeks', '1 month', 'soon', '0d', 'd', '-3h', '6 hours'])
    // An interval of the skill's the tool would not have read is shown as written.
    expect(pace({ ...base, every: '2y' })).toBe('Every 2y')
  })

  test("the pace in force is this machine's where a person set one: its interval, a time of day, or whenever there is work; a pick that cannot be followed leaves the skill's", () => {
    const skill = { command: 'a', on: true, publish: 'commit' as const, every: '6h', when: 'x', waitsFor: 'when a ticket has no plan' }
    const since = '2026-10-08T07:00:00.000Z'
    expect(pace({ ...skill, pace: { every: '30m', since } })).toBe('Every 30 minutes at most, when a ticket has no plan')
    expect(pace({ ...skill, pace: { every: '2d', at: '10:00', since } })).toBe('Every 2 days at 10:00, when a ticket has no plan')
    expect(pace({ ...skill, pace: { every: '2w', since } })).toBe('Every 2 weeks at most, when a ticket has no plan')
    expect(pace({ ...skill, pace: { work: true } })).toBe('When a ticket has no plan')
    expect(pace({ command: 'a', on: true, publish: 'commit', every: '1d', pace: { every: '1mo', at: '9:05', since } })).toBe('Every 1 month at 09:05')
    // No check to ask: "whenever there is work" cannot be followed, the skill's interval stands.
    expect(pace({ command: 'a', on: true, publish: 'commit', every: '1d', pace: { work: true } })).toBe('Every 1 day')
    expect(ownPace({ ...skill, pace: { every: '30m', since } })).toBe(true)
    expect(ownPace({ ...skill, pace: { work: true } })).toBe(true)
    expect(ownPace(skill)).toBe(false)
    expect(ownPace({ command: 'a', on: true, publish: 'commit', every: '1d', pace: { work: true } })).toBe(false)
  })

  test('the Edit box\'s draft: it opens with the pace in force, and reads as the words of the `pace` command; a half-typed one is no pace yet', () => {
    const skill = { command: 'a', on: true, publish: 'commit' as const, every: '6h', when: 'x' }
    const since = '2026-10-08T07:00:00.000Z'
    expect(draftOf(skill)).toEqual({ kind: 'skill' })
    expect(draftOf({ ...skill, pace: { work: true } })).toEqual({ kind: 'work' })
    expect(draftOf({ ...skill, pace: { every: '2d', at: '10:00', since } })).toEqual({ kind: 'every', count: '2', unit: 'd', at: '10:00' })
    expect(draftOf({ ...skill, pace: { every: '30m', since } })).toEqual({ kind: 'every', count: '30', unit: 'm', at: '' })
    // A skill with a check and no interval already runs whenever there is work.
    expect(draftOf({ command: 'a', on: true, publish: 'commit', when: 'x', pace: { work: true } })).toEqual({ kind: 'skill' })

    expect(paceArgs({ kind: 'skill' })).toEqual(['skill'])
    expect(paceArgs({ kind: 'work' })).toEqual(['work'])
    expect(paceArgs({ kind: 'every', count: '2', unit: 'd', at: '10:00' })).toEqual(['2d', '10:00'])
    expect(paceArgs({ kind: 'every', count: ' 15 ', unit: 'm', at: '' })).toEqual(['15m'])
    expect(paceArgs({ kind: 'every', count: '1', unit: 'mo', at: '' })).toEqual(['1mo'])
    // A time left in the field beside minutes or hours is not sent: the page hides the field then.
    expect(paceArgs({ kind: 'every', count: '6', unit: 'h', at: '10:00' })).toEqual(['6h'])
    for (const count of ['', '0', '1.5', '-2', 'two']) expect(paceArgs({ kind: 'every', count, unit: 'd', at: '' }), count).toBeUndefined()
    expect(paceArgs({ kind: 'every', count: '2', unit: 'd', at: '25:00' })).toBeUndefined()

    // What the row would read as, saved.
    expect(pace(withDraft(skill, { kind: 'every', count: '2', unit: 'd', at: '10:00' }))).toBe('Every 2 days at 10:00, when its check finds work')
    expect(pace(withDraft({ ...skill, pace: { every: '30m', since } }, { kind: 'skill' }))).toBe('Every 6 hours at most, when its check finds work')
    expect(pace(withDraft(skill, { kind: 'work' }))).toBe('When its check finds work')
    expect(withDraft(skill, { kind: 'every', count: '', unit: 'd', at: '' })).toBe(skill)
  })

  test('a coming time, for a person: today, tomorrow, the weekday within a week, else the date', () => {
    const now = new Date(2026, 9, 8, 21, 30)
    expect(nextWords(new Date(2026, 9, 8, 23, 0), now)).toBe('today 23:00')
    expect(nextWords(new Date(2026, 9, 9, 10, 0), now)).toBe('tomorrow 10:00')
    expect(nextWords(new Date(2026, 9, 10, 9, 5), now)).toBe('Saturday 09:05')
    expect(nextWords(new Date(2026, 9, 14, 10, 0), now)).toBe('Wednesday 10:00')
    expect(nextWords(new Date(2026, 9, 15, 10, 0), now)).toBe('15 Oct 10:00')
    expect(nextWords(new Date(2026, 10, 7, 10, 0), now)).toBe('7 Nov 10:00')
    // Read off an old tick: the time has passed, and the scheduler has not looked since.
    expect(nextWords(new Date(2026, 9, 8, 10, 0), now)).toBe('as soon as the scheduler looks')
    expect(nextWords(new Date(2026, 9, 3, 10, 0), now)).toBe('as soon as the scheduler looks')
    const waiting = { command: 'a', on: true, publish: 'commit' as const, decision: { command: 'a', outcome: 'not due (next start from 2026-10-10 10:00, every 2d at 10:00)' } }
    expect(decided(waiting, now)).toBe('Next: Saturday 10:00')
    expect(decided({ ...waiting, on: false }, now)).toBe('Off')
  })

  test("how far a scheduled command publishes, by this machine's pick", () => {
    const base = { command: 'a', on: true }
    expect(publishes({ ...base, publish: 'nothing' })).toBe('Publishes nothing')
    expect(publishes({ ...base, publish: 'commit' })).toBe('Commits its work')
    expect(publishes({ ...base, publish: 'branch' })).toBe('Publishes its branch')
    expect(publishes({ ...base, publish: 'pr' })).toBe('Opens a pull request')
    expect(publishes({ ...base, publish: 'merge' })).toBe('Opens a pull request that merges on green')
  })

  test("what the scheduler last decided for a command, for a person: Off, No work, Started a run, a pace in words, how many are running, else the tool's own words", () => {
    const on = { command: 'a', on: true, publish: 'commit' as const }
    const said = (outcome: string, over: object = {}) => decided({ ...on, ...over, decision: { command: 'a', outcome } })
    expect(said('not due')).toBe('No work')
    expect(said('started 2026-10-03T10-00-00-000Z')).toBe('Started a run')
    expect(said('not due (last start 2h ago, every 6h)')).toBe('Started 2h ago, not due yet')
    expect(said('not due (last start less than a minute ago, every 15m)')).toBe('Started less than a minute ago, not due yet')
    expect(said('cap reached (1 in flight: 2026-10-03T10-00-00-000Z on other-box)')).toBe('One is already running')
    expect(said('cap reached (3 in flight: a on x, b on y, c on z)')).toBe('3 are already running')
    // A reason only the tool knows stays in the tool's words.
    expect(said('quota: the week is 90% used')).toBe('Quota: the week is 90% used')
    expect(said('check failed: not found: queue')).toBe('Check failed: not found: queue')
    expect(said('not ready: `claude` is not logged in.')).toBe('Not ready: `claude` is not logged in.')
    // Switched on a moment ago: the last tick still said off, and no tick has decided yet.
    expect(said('switched off on this machine')).toBeUndefined()
    expect(decided(on)).toBeUndefined()
    // Switched off here, whatever the last tick said.
    expect(said('not due', { on: false })).toBe('Off')
    expect(decided({ ...on, on: false })).toBe('Off')
    // A command the coding agent cannot run says so whatever its switch: switching it on would start nothing.
    const elsewhere = 'not a command of the coding agent: its skill is only under .agents/skills, not .claude/skills'
    expect(said(elsewhere, { on: false })).toBe('Cannot start: its skill is only in .agents/skills, which Claude Code does not read')
    expect(said(elsewhere)).toBe('Cannot start: its skill is only in .agents/skills, which Claude Code does not read')
  })

  test('the publish menu: every pick with a git host package, Nothing, Commit and Publish branch without; the pick in force is listed even when not offered', () => {
    expect(publishChoices(true, 'pr')).toEqual(['nothing', 'commit', 'branch', 'pr', 'merge'])
    expect(publishChoices(false, 'commit')).toEqual(['nothing', 'commit', 'branch'])
    expect(publishChoices(false, 'pr')).toEqual(['nothing', 'commit', 'branch', 'pr'])
  })
})
