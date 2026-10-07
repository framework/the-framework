import type { AgentMeta, OpenAgentEvent } from '../../src/index.js'
import { describe, expect, test } from 'vitest'
import { holdsMainAgent, isOpenSubagent, nestRows, startedBefore, subagentEnd, subagentStartedAt, subagentsOf, taskLabel } from './subagents.js'

function agent(id: string, over: Partial<AgentMeta> = {}): AgentMeta {
  return { status: 'done', id, startedAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z', ...over }
}
const row = (key: string, a: AgentMeta) => ({ key, agent: a })

describe('subagentsOf', () => {
  test("a run's subagents are the runs whose card names it as their parent, oldest first", () => {
    const agents = [agent('c2', { parent: 'main' }), agent('other'), agent('c1', { parent: 'main' }), agent('x1', { parent: 'else' }), agent('main')]
    expect(subagentsOf(agents, 'main').map(a => a.id)).toEqual(['c1', 'c2'])
    expect(subagentsOf(agents, 'other')).toEqual([])
  })
})

describe('taskLabel', () => {
  test('a subagent is called by the first line of what it was asked', () => {
    expect(taskLabel(agent('c1', { intent: 'Validate the form\n\nYou are a subagent: another agent started you.' }))).toBe('Validate the form')
    expect(taskLabel(agent('c1', { branch: 'agent-form' }))).toBe('agent-form')
  })
})

describe('isOpenSubagent', () => {
  test('a working subagent and one stopped on a question are not over; any other is', () => {
    expect(['running', 'waiting', 'done', 'failed', 'stopped'].filter(status => isOpenSubagent({ status: status as AgentMeta['status'] }))).toEqual(['running', 'waiting'])
  })
})

describe('nestRows', () => {
  test('a run whose parent is in the list sits under it, oldest first, and the other rows keep their order', () => {
    const tree = nestRows([row('c2', agent('c2', { parent: 'main' })), row('solo', agent('solo')), row('c1', agent('c1', { parent: 'main' })), row('main', agent('main'))])
    expect(tree.map(t => [t.row.key, t.subagents.map(s => s.key)])).toEqual([
      ['solo', []],
      ['main', ['c1', 'c2']],
    ])
  })

  test('a run whose parent is not in the list is a row of its own', () => {
    expect(nestRows([row('c1', agent('c1', { parent: 'gone' }))]).map(t => t.row.key)).toEqual(['c1'])
  })

  test('a run started for a subagent is a row of its own: the tree is one level deep, and no row is lost', () => {
    const tree = nestRows([row('g1', agent('g1', { parent: 'c1' })), row('c1', agent('c1', { parent: 'main' })), row('main', agent('main'))])
    expect(tree.map(t => [t.row.key, t.subagents.map(s => s.key)])).toEqual([
      ['g1', []],
      ['main', ['c1']],
    ])
  })

  test('in a list that pools projects a parent is looked for in the same project only', () => {
    const tree = nestRows([row('p1:c1', agent('c1', { parent: 'main' })), row('p2:main', agent('main')), row('p1:main', agent('main'))])
    expect(tree.map(t => [t.row.key, t.subagents.map(s => s.key)])).toEqual([
      ['p2:main', []],
      ['p1:main', ['p1:c1']],
    ])
  })
})

describe('subagentEnd', () => {
  const subagents = [agent('2026-10-01T10-00-00-000Z', { parent: 'main' })]

  test("the line a run is sent when its subagent ends reads as that subagent's end: how it ended, and the rest of what was said", () => {
    const end = subagentEnd('The run 2026-10-01T10-00-00-000Z, started for this run, ended done.\nIts work is on the branch agent-form.\n\nIts last words:\nAll done.', subagents)
    expect(end).toEqual({ agent: subagents[0], status: 'done', rest: 'Its work is on the branch agent-form.\n\nIts last words:\nAll done.' })
  })

  test('an end that says why carries the reason', () => {
    expect(subagentEnd('The run 2026-10-01T10-00-00-000Z, started for this run, ended failed: could not create a checkout: no such ref.', subagents)).toEqual({
      agent: subagents[0],
      status: 'failed',
      detail: 'could not create a checkout: no such ref',
      rest: '',
    })
  })

  test("the same words about a run that is not one of this run's subagents, and any other prompt, read as a person's", () => {
    expect(subagentEnd('The run 2026-09-01T10-00-00-000Z, started for this run, ended done.', subagents)).toBeUndefined()
    expect(subagentEnd('Note: The run 2026-10-01T10-00-00-000Z, started for this run, ended done.', subagents)).toBeUndefined()
    expect(subagentEnd('The run 2026-10-01T10-00-00-000Z, started for this run, ended done.', [])).toBeUndefined()
  })
})

describe('startedBefore', () => {
  const at = (time: string): OpenAgentEvent => ({ kind: 'log', message: time, at: `2026-10-01T10:${time}.000Z` }) as OpenAgentEvent

  test('a subagent goes before the first event written after it started; one started after the last event goes at the end', () => {
    const events = [at('00:00'), at('02:00'), { kind: 'log', message: 'no time' } as OpenAgentEvent, at('04:00')]
    const rows = startedBefore(events, [agent('a', { startedAt: '2026-10-01T10:01:00.000Z' }), agent('b', { startedAt: '2026-10-01T10:01:30.000Z' }), agent('c', { startedAt: '2026-10-01T10:03:00.000Z' }), agent('d', { startedAt: '2026-10-01T10:09:00.000Z' })])
    expect([...rows].map(([index, agents]) => [index, agents.map(a => a.id)])).toEqual([
      [1, ['a', 'b']],
      [3, ['c']],
      [4, ['d']],
    ])
  })
})

describe('subagentStartedAt', () => {
  test("a subagent started when its id was made, whatever start time its card carries now; an id that is no time falls back to the card's", () => {
    expect(subagentStartedAt(agent('2026-10-01T10-01-00-000Z', { startedAt: '2026-10-01T10:01:07.500Z' }))).toBe('2026-10-01T10:01:00.000Z')
    expect(subagentStartedAt(agent('c1', { startedAt: '2026-10-01T10:01:07.500Z' }))).toBe('2026-10-01T10:01:07.500Z')
  })

  test("a subagent's row keeps its place when its card's start time moves past the next line of the log", () => {
    const events = [{ kind: 'log', message: 'a', at: '2026-10-01T10:00:59.000Z' }, { kind: 'log', message: 'b', at: '2026-10-01T10:01:05.000Z' }] as OpenAgentEvent[]
    const rows = startedBefore(events, [agent('2026-10-01T10-01-00-000Z', { startedAt: '2026-10-01T10:01:07.500Z' })])
    expect([...rows.keys()]).toEqual([1])
  })
})

describe('holdsMainAgent', () => {
  const now = Date.parse('2026-10-01T10:05:00.000Z')
  test("a main agent's job is not over with a subagent that works, saves, or ended in the last seconds", () => {
    expect(holdsMainAgent({ status: 'running' }, now)).toBe(true)
    expect(holdsMainAgent({ status: 'done', saving: true, endedAt: '2026-10-01T10:00:00.000Z' }, now)).toBe(true)
    expect(holdsMainAgent({ status: 'done', endedAt: '2026-10-01T10:04:55.000Z' }, now)).toBe(true)
    expect(holdsMainAgent({ status: 'failed', endedAt: '2026-10-01T10:04:51.000Z' }, now)).toBe(true)
  })

  test('it is over with one that ended ten seconds ago or more, and with one that only waits', () => {
    expect(holdsMainAgent({ status: 'done', endedAt: '2026-10-01T10:04:50.000Z' }, now)).toBe(false)
    expect(holdsMainAgent({ status: 'waiting' }, now)).toBe(false)
  })
})
