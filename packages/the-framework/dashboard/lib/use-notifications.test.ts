import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Activity, Intervention } from '../../src/index.js'
import { useActivityNotifications, useInterventionNotifications } from './use-notifications.js'

const ctor = vi.fn()

beforeEach(() => {
  ctor.mockReset()
  class FakeNotification {
    static permission = 'granted'
    onclick: (() => void) | null = null
    constructor(title: string, opts?: NotificationOptions) {
      ctor(title, opts)
    }
    close(): void {}
  }
  vi.stubGlobal('Notification', FakeNotification)
})
afterEach(() => vi.unstubAllGlobals())

describe('useInterventionNotifications (#627)', () => {
  const item = (n: number, url: string): Intervention => ({ projectId: 'p', projectName: 'p', kind: 'pr', number: n, title: `pr ${n}`, url })
  const awaiting = (awaitId: string, title: string): Intervention => ({ projectId: 'p', projectName: 'p', kind: 'awaiting', title, url: '', awaitId })

  const render = (enabled: boolean) =>
    renderHook(({ items }) => useInterventionNotifications(items, enabled), { initialProps: { items: [] as Intervention[] } })

  test('stays quiet for PRs already open at load, then fires for one that appears later', () => {
    const { rerender } = render(true)
    rerender({ items: [item(1, 'u1')] }) // first fetch of an already-open PR -> baseline, no notify
    expect(ctor).not.toHaveBeenCalled()
    rerender({ items: [item(1, 'u1'), item(2, 'u2')] }) // a genuinely new PR -> notify once
    expect(ctor).toHaveBeenCalledTimes(1)
    expect(ctor.mock.calls[0]![0]).toContain('Human Queue')
  })

  test('fires for a paused run that appears later, showing its question (#636)', () => {
    const { rerender } = render(true)
    rerender({ items: [] }) // baseline
    rerender({ items: [awaiting('g1', 'Cache the auth store?')] })
    expect(ctor).toHaveBeenCalledTimes(1)
    expect(ctor.mock.calls[0]![1]?.body).toContain('Cache the auth store?')
  })

  test('never fires when notifications are disabled', () => {
    const { rerender } = render(false)
    rerender({ items: [item(1, 'u1')] })
    rerender({ items: [item(1, 'u1'), item(2, 'u2')] })
    expect(ctor).not.toHaveBeenCalled()
  })
})

describe('useActivityNotifications (#627)', () => {
  const startedAgent = (agentId: string, title?: string): Activity => ({ projectId: 'p', projectName: 'p', agentId: agentId, kind: 'started', ...(title ? { title } : {}) })
  const finishedAgent = (agentId: string, title?: string): Activity => ({ projectId: 'p', projectName: 'p', agentId: agentId, kind: 'finished', ...(title ? { title } : {}) })

  const render = (enabled: boolean) =>
    renderHook(({ items }) => useActivityNotifications(items, enabled), { initialProps: { items: [] as Activity[] } })

  test('stays quiet for runs already present at load, then fires when a run starts', () => {
    const { rerender } = render(true)
    rerender({ items: [finishedAgent('r1', 'seed')] }) // first fetch of an existing run -> baseline, no notify
    expect(ctor).not.toHaveBeenCalled()
    rerender({ items: [startedAgent('r2', 'add cart'), finishedAgent('r1', 'seed')] }) // a run just started -> notify
    expect(ctor).toHaveBeenCalledTimes(1)
    expect(ctor.mock.calls[0]![0]).toContain('Agent started')
    expect(ctor.mock.calls[0]![1]?.body).toContain('add cart')
  })

  test('fires again when the same run finishes (distinct key)', () => {
    const { rerender } = render(true)
    rerender({ items: [] }) // baseline
    rerender({ items: [startedAgent('r1', 'work')] }) // started
    rerender({ items: [finishedAgent('r1', 'work')] }) // finished -> a new key
    expect(ctor).toHaveBeenCalledTimes(2)
    expect(ctor.mock.calls[1]![0]).toContain('Agent finished')
  })

  test('never fires when disabled', () => {
    const { rerender } = render(false)
    rerender({ items: [startedAgent('r1')] })
    rerender({ items: [startedAgent('r1'), startedAgent('r2')] })
    expect(ctor).not.toHaveBeenCalled()
  })
})
