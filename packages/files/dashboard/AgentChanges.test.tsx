import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithHost as render } from './test-host.js'

const readChanges = vi.fn(async () => [] as unknown)
const readDiff = vi.fn(async () => null as unknown)
vi.mock('./reads.js', () => ({ readChanges, readDiff, readContent: vi.fn() }))

const { ChangesSummary, ChangesDetails } = await import('./AgentChanges.js')

const CHANGES = [
  { path: 'src/a.ts', status: 'modified', added: 3, removed: 1, binary: false },
  { path: 'src/new.ts', status: 'untracked', added: 10, removed: 0, binary: false },
]

// The last read is kept per run for the page's life, so each test names its own run.
let run = 0
const nextRun = () => `run-${++run}`

beforeEach(() => {
  readChanges.mockClear()
  readDiff.mockClear()
  readChanges.mockResolvedValue(CHANGES)
  readDiff.mockResolvedValue({
    path: 'src/a.ts',
    status: 'modified',
    patch: '@@ -1 +1 @@\n-const b = 2\n+const b = 3',
    added: 1,
    removed: 1,
    truncated: false,
    binary: false,
  })
})
afterEach(cleanup)

/** Both slots of one run, as the run's page renders them. */
function Slots(props: { agentId: string; working: boolean; expanded: boolean }) {
  return (
    <>
      <ChangesSummary projectId="p1" {...props} />
      <ChangesDetails projectId="p1" {...props} />
    </>
  )
}

describe('a working run’s changes (#817)', () => {
  test('the bar counts the files and lines the run changed, read from its own checkout (#1023)', async () => {
    const agentId = nextRun()
    render(<Slots agentId={agentId} working expanded={false} />)
    await waitFor(() => expect(readChanges).toHaveBeenCalledWith(expect.anything(), 'p1', agentId))
    // 3 + 10 added, 1 removed, across two files.
    await waitFor(() => expect(screen.getByText('2 files')).toBeTruthy())
    expect(screen.getByText('+13')).toBeTruthy()
    // Closed means the rows are not there — only the count.
    expect(screen.queryByText('a.ts')).toBeNull()
  })

  test('the open bar lists the changed files, read once for both', async () => {
    const agentId = nextRun()
    render(<Slots agentId={agentId} working expanded />)
    await waitFor(() => expect(screen.getByText('a.ts')).toBeTruthy())
    expect(screen.getByText('new.ts')).toBeTruthy()
    expect(screen.getByText('modified')).toBeTruthy()
    expect(screen.getByText('new')).toBeTruthy()
    expect(readChanges).toHaveBeenCalledTimes(1)
  })

  test('a run that changed nothing shows no count and no list', async () => {
    readChanges.mockResolvedValue([])
    const agentId = nextRun()
    const { container } = render(<Slots agentId={agentId} working expanded />)
    await waitFor(() => expect(readChanges).toHaveBeenCalled())
    expect(container.textContent).toBe('')
    expect(screen.queryByLabelText('Changed files')).toBeNull()
  })

  test('no diff is read until a file is expanded', async () => {
    const agentId = nextRun()
    render(<Slots agentId={agentId} working expanded />)
    await waitFor(() => expect(screen.getByText('a.ts')).toBeTruthy())
    // A session that touched forty files would otherwise be forty diffs nobody asked for.
    expect(readDiff).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('a.ts'))
    await waitFor(() => expect(readDiff).toHaveBeenCalledWith(expect.anything(), 'p1', 'src/a.ts', agentId))
    await waitFor(() => expect(screen.getByText('+const b = 3')).toBeTruthy())
  })

  test('a run that stops keeps the count it ended with, reads no more, and drops its list (#1030)', async () => {
    const agentId = nextRun()
    const { rerender } = render(<Slots agentId={agentId} working expanded />)
    await waitFor(() => expect(screen.getByText('2 files')).toBeTruthy())
    readChanges.mockClear()
    rerender(<Slots agentId={agentId} working={false} expanded />)
    expect(screen.getByText('2 files')).toBeTruthy()
    expect(screen.queryByText('a.ts')).toBeNull()
    expect(readChanges).not.toHaveBeenCalled()
  })

  test('a run never seen working reads nothing: its checkout may be gone', async () => {
    const agentId = nextRun()
    const { container } = render(<Slots agentId={agentId} working={false} expanded />)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(readChanges).not.toHaveBeenCalled()
    expect(container.textContent).toBe('')
  })

  test('a failed read leaves the slots silent instead of throwing', async () => {
    readChanges.mockRejectedValue(new Error('daemon restarted'))
    const agentId = nextRun()
    const { container } = render(<Slots agentId={agentId} working expanded />)
    await waitFor(() => expect(readChanges).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })
})
