import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { AgentMeta } from '../../src/index.js'

const onAgents = vi.hoisted(() => vi.fn())
vi.mock('../rpc/reads.js', () => ({ onAgents }))

const { useAgents } = await import('./use-agents.js')

const agents = (id: string): AgentMeta[] => [{ id, status: 'done' } as AgentMeta]
const settle = (ms = 0): Promise<void> => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

describe('useAgents', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    onAgents.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  test('reads nothing until a project is selected', async () => {
    const { result } = renderHook(() => useAgents(null))
    await settle(10_000)
    expect(onAgents).not.toHaveBeenCalled()
    expect(result.current.agents).toEqual([])
  })

  test('polls the selected project every 2s', async () => {
    onAgents.mockResolvedValue(agents('a1'))
    const { result } = renderHook(() => useAgents('a'))
    await settle()
    expect(result.current.agents).toEqual(agents('a1'))

    onAgents.mockResolvedValue(agents('a2'))
    await settle(2000)
    expect(result.current.agents).toEqual(agents('a2'))
  })

  test('reload shows a just-started run without waiting for the next tick', async () => {
    onAgents.mockResolvedValue(agents('a1'))
    const { result } = renderHook(() => useAgents('a'))
    await settle()

    onAgents.mockResolvedValue(agents('a2'))
    await act(async () => result.current.reload())
    expect(result.current.agents).toEqual(agents('a2'))
  })

  test('a reload in flight during a project switch cannot write the old project s runs', async () => {
    let resolveA: (v: AgentMeta[]) => void = () => {}
    onAgents.mockResolvedValue(agents('a1'))
    const { result, rerender } = renderHook(({ id }) => useAgents(id), { initialProps: { id: 'a' } })
    await settle()

    onAgents.mockReturnValue(new Promise<AgentMeta[]>(r => (resolveA = r)))
    result.current.reload() // in flight against project a
    onAgents.mockResolvedValue(agents('b1'))
    rerender({ id: 'b' })
    await settle()
    expect(result.current.agents).toEqual(agents('b1'))

    resolveA(agents('a-late')) // a's reload lands after the switch
    await settle()
    expect(result.current.agents).toEqual(agents('b1')) // b's rail never shows a's runs
  })

  test('switching project clears the previous project s runs rather than showing them', async () => {
    onAgents.mockResolvedValue(agents('a1'))
    const { result, rerender } = renderHook(({ id }) => useAgents(id), { initialProps: { id: 'a' } })
    await settle()
    expect(result.current.agents).toEqual(agents('a1'))

    let resolveB: (v: AgentMeta[]) => void = () => {}
    onAgents.mockReturnValue(new Promise<AgentMeta[]>(r => (resolveB = r)))
    rerender({ id: 'b' })
    expect(result.current.agents).toEqual([]) // not a's runs, while b is still loading

    await act(async () => resolveB(agents('b1')))
    expect(result.current.agents).toEqual(agents('b1'))
  })

  test('a failed read keeps the last runs rather than emptying the rail', async () => {
    onAgents.mockResolvedValue(agents('a1'))
    const { result } = renderHook(() => useAgents('a'))
    await settle()

    onAgents.mockRejectedValue(new Error('daemon restarted'))
    await settle(2000)
    expect(result.current.agents).toEqual(agents('a1')) // and no unhandled rejection
  })
})
