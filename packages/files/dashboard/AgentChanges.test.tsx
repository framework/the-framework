import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { renderWithHost as render } from './test-host.js'

const readChanges = vi.fn(async () => [] as unknown)
vi.mock('./reads.js', () => ({ readChanges }))

const { ChangesSummary } = await import('./AgentChanges.js')

const CHANGES = [
  { path: 'src/a.ts', status: 'modified', added: 3, removed: 1, binary: false },
  { path: 'src/new.ts', status: 'untracked', added: 10, removed: 0, binary: false },
]

beforeEach(() => {
  readChanges.mockClear()
  readChanges.mockResolvedValue(CHANGES)
})
afterEach(cleanup)

describe('a working run’s changes (#817)', () => {
  test('the bar counts the files and lines the run changed, read from its own checkout, and names no file (#1023)', async () => {
    render(<ChangesSummary projectId="p1" agentId="run-1" working />)
    await waitFor(() => expect(readChanges).toHaveBeenCalledWith(expect.anything(), 'p1', 'run-1'))
    // 3 + 10 added, 1 removed, across two files.
    await waitFor(() => expect(screen.getByText('2 files')).toBeTruthy())
    expect(screen.getByText('+13')).toBeTruthy()
    expect(screen.queryByText(/a\.ts/)).toBeNull()
    expect(readChanges).toHaveBeenCalledTimes(1)
  })

  test('a run that changed nothing shows no count', async () => {
    readChanges.mockResolvedValue([])
    const { container } = render(<ChangesSummary projectId="p1" agentId="run-1" working />)
    await waitFor(() => expect(readChanges).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  test('a run that stops keeps the count it ended with and reads no more (#1030)', async () => {
    const { rerender } = render(<ChangesSummary projectId="p1" agentId="run-1" working />)
    await waitFor(() => expect(screen.getByText('2 files')).toBeTruthy())
    readChanges.mockClear()
    rerender(<ChangesSummary projectId="p1" agentId="run-1" working={false} />)
    expect(screen.getByText('2 files')).toBeTruthy()
    expect(readChanges).not.toHaveBeenCalled()
  })

  test('one run’s count never shows as another’s: the page swaps runs in place', async () => {
    const { rerender, container } = render(<ChangesSummary projectId="p1" agentId="run-1" working />)
    await waitFor(() => expect(screen.getByText('2 files')).toBeTruthy())
    rerender(<ChangesSummary projectId="p1" agentId="run-2" working={false} />)
    expect(container.textContent).toBe('')
  })

  test('a run never seen working reads nothing: its checkout may be gone', async () => {
    const { container } = render(<ChangesSummary projectId="p1" agentId="run-1" working={false} />)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(readChanges).not.toHaveBeenCalled()
    expect(container.textContent).toBe('')
  })

  test('a failed read leaves the bar silent instead of throwing', async () => {
    readChanges.mockRejectedValue(new Error('daemon restarted'))
    const { container } = render(<ChangesSummary projectId="p1" agentId="run-1" working />)
    await waitFor(() => expect(readChanges).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })
})
