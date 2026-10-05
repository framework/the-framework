import { describe, expect, test } from 'vitest'
import { STATUS, hostAnswering } from './fixtures.js'
import { loosestSpendOffset, offsetsThatDiffer, pace, publishChoices, publishes, readSchedulers, saveSpendOffset, schedulerRow, schedulerStatus, typedOffset } from './schedulers.js'

const GEMSTACK = { id: 'p1', name: 'gemstack', gitHost: true }
const OTHER = { id: 'p2', name: 'other', gitHost: false }

describe('a scheduler row, from what status printed', () => {
  test("each scheduled command carries this machine's switch and publish pick over what its line says", () => {
    const row = schedulerRow(GEMSTACK, STATUS)
    expect(row).toMatchObject({ project: GEMSTACK, on: true, keepAlive: false, running: true, model: 'opus', spendOffset: 7 })
    expect(row.commands).toEqual([
      { command: 'work-queue', when: 'npx queue', on: true, publish: 'merge', publishPick: 'nothing' },
      // The line says off; this machine switched it on.
      { command: 'post-merge-cleanup', every: '1d', on: true },
    ])
    expect(row.lastTick).toEqual({ at: '2026-10-03T10:00:00.000Z', decisions: STATUS.lastTick.decisions })
  })

  test('a scheduler that never ticked lists no command; a field that is not what the command promises reads as absent', () => {
    expect(schedulerRow(GEMSTACK, { ok: true, on: false, keepAlive: false, model: 'opus', spendOffset: 7.14, running: false })).toEqual({ project: GEMSTACK, on: false, keepAlive: false, running: false, model: 'opus', spendOffset: 7.14, commands: [] })
    const odd = schedulerRow(GEMSTACK, {
      on: 'yes',
      spendOffset: 'far',
      model: 3,
      publishes: { a: 'push' },
      lastTick: { at: '2026-10-03T10:00:00.000Z', note: 'no agent-schedule.md', decisions: [{ command: 'a' }, 'x'], schedule: [{ command: 'a', on: true, publish: 'push' }, { command: 'b' }, null] },
    })
    expect(odd).toEqual({ project: GEMSTACK, on: false, keepAlive: false, running: false, lastTick: { at: '2026-10-03T10:00:00.000Z', decisions: [], note: 'no agent-schedule.md' }, commands: [{ command: 'a', on: true }] })
    expect(schedulerRow(GEMSTACK, null).commands).toEqual([])
  })
})

describe('reading and saving through the command', () => {
  test('status runs in every project; a project whose command fails is a row that says why', async () => {
    const { host, runCommand } = hostAnswering(projectId => (projectId === 'p1' ? { ok: true, output: STATUS } : { ok: false, error: 'not inside a git repository' }))
    const rows = await readSchedulers(host, [GEMSTACK, OTHER])
    expect(runCommand.mock.calls).toEqual([['p1', ['status']], ['p2', ['status']]])
    expect(rows[0]!.commands).toHaveLength(2)
    expect(rows[1]).toEqual({ project: OTHER, error: 'not inside a git repository', on: false, keepAlive: false, running: false, commands: [] })
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

  test('the pace: an interval, a check, or both', () => {
    expect(pace({ command: 'a', every: '1d', on: true })).toBe('every 1d')
    expect(pace({ command: 'a', when: 'npx queue', on: true })).toBe('when its check finds work')
    expect(pace({ command: 'a', every: '6h', when: 'x', on: true })).toBe('every 6h at most, when its check finds work')
  })

  test('how far a scheduled command publishes: this machine\'s pick, else what its line says, nothing when it says none', () => {
    expect(publishes({ command: 'a', on: true })).toBe('publishes nothing')
    expect(publishes({ command: 'a', on: true, publish: 'commit' })).toBe('commits its work')
    expect(publishes({ command: 'a', on: true, publish: 'branch' })).toBe('publishes its branch')
    expect(publishes({ command: 'a', on: true, publish: 'pr' })).toBe('opens a pull request')
    expect(publishes({ command: 'a', on: true, publish: 'merge' })).toBe('opens a pull request that merges on green')
    expect(publishes({ command: 'a', on: true, publish: 'merge', publishPick: 'nothing' })).toBe('publishes nothing')
    expect(publishes({ command: 'a', on: true, publishPick: 'pr' })).toBe('opens a pull request')
  })

  test('the publish menu: every pick with a git host package, Nothing, Commit and Publish branch without; a saved pick no longer offered is still listed', () => {
    expect(publishChoices(true, 'pr')).toEqual(['nothing', 'commit', 'branch', 'pr', 'merge'])
    expect(publishChoices(false, undefined)).toEqual(['nothing', 'commit', 'branch'])
    expect(publishChoices(false, 'pr')).toEqual(['nothing', 'commit', 'branch', 'pr'])
  })
})
