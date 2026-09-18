import { describe, expect, test } from 'vitest'
import type { FrameworkEvent } from '../../src/index.js'
import { agentStatusPill } from './agent-status.js'

const said = { kind: 'driver', event: { type: 'text', text: 'working' } } as FrameworkEvent
const ended = (over: Record<string, unknown>) => ({ kind: 'end', ...over }) as FrameworkEvent

describe('agentStatusPill', () => {
  test('says nothing while the run is live, or once it ended clean', () => {
    expect(agentStatusPill([])).toBeNull()
    expect(agentStatusPill([said])).toBeNull()
    expect(agentStatusPill([said, ended({ ok: true })])).toBeNull()
  })

  test('a stopped run says stopped', () => {
    expect(agentStatusPill([said, ended({ ok: false, stopped: true })])).toMatchObject({ label: 'stopped', tone: 'text-warning' })
  })

  test('a failed run says failed, and carries the reason', () => {
    expect(agentStatusPill([said, ended({ ok: false, detail: 'exit 1' })])).toMatchObject({ label: 'failed — exit 1', tone: 'text-danger' })
    expect(agentStatusPill([said, ended({ ok: false })])).toMatchObject({ label: 'failed' })
  })

  // A run that asked ends on its question (#1774): not failed, not finished, waiting on you.
  test('a run that ended on its question says it waits for an answer, not that it failed', () => {
    expect(agentStatusPill([said, ended({ ok: false, waiting: true })])).toMatchObject({ label: 'waiting for an answer', tone: 'text-warning' })
  })

  test('answered, the same run is live again: the leg it waited in is behind it', () => {
    const answered = [said, ended({ ok: false, waiting: true }), said]
    expect(agentStatusPill(answered)).toBeNull()
    expect(agentStatusPill([...answered, ended({ ok: false, stopped: true })])).toMatchObject({ label: 'stopped' })
  })
})
