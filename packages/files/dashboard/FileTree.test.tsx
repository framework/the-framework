import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithHost as render } from './test-host.js'

const readProject = vi.fn(async () => ({ files: [], changes: {} }) as unknown)
const readTree = vi.fn(async () => ({ source: 'checkout', files: [], changes: {} }) as unknown)
vi.mock('./reads.js', () => ({ readProject, readTree }))

const { FileTree } = await import('./FileTree.js')

/** The Context with these files in it; toggling one calls `toggle`. */
const context = (files: string[] = [], toggle: (path: string) => void = () => {}) => ({ files: new Set(files), toggle })
/** A folder's clickable row (its name shows twice: the closed and the open icon's row). */
const folder = (name: string) => screen.getAllByText(name)[0]!.closest('summary')!
const files = ['src/app.ts', 'README.md']

beforeEach(() => {
  readProject.mockClear()
  readProject.mockResolvedValue({ files, changes: {} })
  readTree.mockClear()
  readTree.mockResolvedValue({ source: 'checkout', files, changes: {} })
})
afterEach(cleanup)

describe('FileTree (#815)', () => {
  test('the project home reads the project checkout', async () => {
    render(<FileTree projectId="p1" context={context()} />)
    await waitFor(() => expect(readProject).toHaveBeenCalledWith(expect.anything(), 'p1'))
    expect(readTree).not.toHaveBeenCalled()
  })

  test("a session's tree is the session's own, not the project's", async () => {
    // The action bar right above the tree has resolved the worktree since #738. Reading the
    // project root here put a clean branch next to another checkout's M/U/D dots.
    readTree.mockResolvedValue({ source: 'checkout', files: ['only-in-run.ts'], changes: {} })
    render(<FileTree projectId="p1" agentId="run-1" context={context()} />)
    await waitFor(() => expect(screen.getByText('only-in-run.ts')).toBeTruthy())
    expect(readTree).toHaveBeenCalledWith(expect.anything(), 'p1', 'run-1')
    expect(readProject).not.toHaveBeenCalled()
    expect(screen.queryByText('README.md')).toBeNull()
  })

  test('switching session re-reads, rather than keeping the previous one’s marks', async () => {
    const { rerender } = render(
      <FileTree projectId="p1" agentId="run-1" context={context()} />,
    )
    await waitFor(() => expect(readTree).toHaveBeenCalledWith(expect.anything(), 'p1', 'run-1'))
    rerender(<FileTree projectId="p1" agentId="run-2" context={context()} />)
    await waitFor(() => expect(readTree).toHaveBeenCalledWith(expect.anything(), 'p1', 'run-2'))
  })

  test('a changed file shows its letter, committed and uncommitted drawn apart', async () => {
    readTree.mockResolvedValue({
      source: 'checkout',
      files,
      changes: { 'README.md': { status: 'modified', committed: false }, 'src/app.ts': { status: 'added', committed: true } },
    })
    render(<FileTree projectId="p1" agentId="run-1" context={context()} />)
    await waitFor(() => expect(screen.getByLabelText('modified, not committed')).toBeTruthy())
    fireEvent.click(folder('src'))
    await waitFor(() => expect(screen.getByLabelText('added, committed').textContent).toBe('A'))
    expect(screen.getByText('From the run’s checkout')).toBeTruthy()
  })

  test('a finished run with no checkout is read from its branch, then its merge, and says which', async () => {
    readTree.mockResolvedValue({ source: 'branch', branch: 'agent-fix', files, changes: {} })
    const { rerender } = render(<FileTree projectId="p1" agentId="run-1" context={context()} />)
    await waitFor(() => expect(screen.getByText('From branch agent-fix')).toBeTruthy())
    readTree.mockResolvedValue({ source: 'merge', number: 42, files, changes: {} })
    rerender(<FileTree projectId="p1" agentId="run-2" context={context()} />)
    await waitFor(() => expect(screen.getByText('From the merge of #42')).toBeTruthy())
  })

  test('a run that changed nothing shows the project’s files with nothing marked, and says so in the caption', async () => {
    readTree.mockResolvedValue({ source: 'unchanged', files, changes: {} })
    render(<FileTree projectId="p1" agentId="run-1" context={context()} />)
    await waitFor(() => expect(screen.getByText('This run changed no files')).toBeTruthy())
    expect(screen.getByText('README.md')).toBeTruthy()
    expect(screen.queryByLabelText(/committed/)).toBeNull()
    expect(screen.queryByText(/gone from this machine/)).toBeNull()
  })

  test('a run that is starting says so, and is read again within seconds until its checkout is there', async () => {
    readTree.mockResolvedValue({ source: 'pending' })
    render(<FileTree projectId="p1" agentId="run-1" context={context()} />)
    await waitFor(() => expect(screen.getByText('Looking for this run’s changes…')).toBeTruthy())
    readTree.mockResolvedValue({ source: 'checkout', files: ['made-by-run.ts'], changes: {} })
    // Well before the 8s poll: the starting run's own, sooner read.
    await waitFor(() => expect(screen.getByText('made-by-run.ts')).toBeTruthy(), { timeout: 3_000 })
  })

  test('a run starting here shows the project’s files, nothing marked, captioned so, until its checkout is there', async () => {
    readTree.mockResolvedValue({ source: 'starting', files, changes: {} })
    render(<FileTree projectId="p1" agentId="run-1" context={context()} />)
    await waitFor(() => expect(screen.getByText('Starting from the project’s files')).toBeTruthy())
    expect(screen.getByText('README.md')).toBeTruthy()
    readTree.mockResolvedValue({ source: 'checkout', files: ['made-by-run.ts'], changes: {} })
    await waitFor(() => expect(screen.getByText('made-by-run.ts')).toBeTruthy(), { timeout: 3_000 })
  })

  test('the agent doing something reads the tree again at once, not on the next poll', async () => {
    const { rerender } = render(<FileTree projectId="p1" agentId="run-1" activity={3} context={context()} />)
    await waitFor(() => expect(screen.getByText('README.md')).toBeTruthy())
    readTree.mockResolvedValue({ source: 'checkout', files: [...files, 'hello.txt'], changes: { 'hello.txt': { status: 'added', committed: false } } })
    rerender(<FileTree projectId="p1" agentId="run-1" activity={4} context={context()} />)
    await waitFor(() => expect(screen.getByText('hello.txt')).toBeTruthy(), { timeout: 1_500 })
  })

  test('a run whose files are moving (pending after a tree) keeps showing the tree it had, never a blank', async () => {
    readTree.mockResolvedValue({ source: 'checkout', files: [...files, 'hello.txt'], changes: {} })
    const { rerender } = render(<FileTree projectId="p1" agentId="run-1" activity={1} context={context()} />)
    await waitFor(() => expect(screen.getByText('hello.txt')).toBeTruthy())
    readTree.mockResolvedValue({ source: 'pending' })
    rerender(<FileTree projectId="p1" agentId="run-1" activity={2} context={context()} />)
    await waitFor(() => expect(readTree.mock.calls.length).toBeGreaterThan(1))
    await new Promise(resolve => setTimeout(resolve, 400))
    expect(screen.getByText('hello.txt')).toBeTruthy()
    expect(screen.queryByText('Looking for this run’s changes…')).toBeNull()
  })

  test('a run whose changes are gone says so, instead of showing the project unmarked', async () => {
    readTree.mockResolvedValue({ source: 'gone' })
    render(<FileTree projectId="p1" agentId="run-1" context={context()} />)
    await waitFor(() => expect(screen.getByText(/This run’s changes are gone from this machine/)).toBeTruthy())
    expect(screen.queryByText('README.md')).toBeNull()
  })

  test('a folder’s contents are built only while it is open', async () => {
    // A repository's whole tree was ~18,000 page elements, closed folders included: the tab was
    // slow to open and every re-render of the page walked all of it.
    readProject.mockResolvedValue({ files: ['src/app.ts', 'src/lib/util.ts'], changes: {} })
    render(<FileTree projectId="p1" context={context()} />)
    await waitFor(() => expect(folder('src')).toBeTruthy())
    expect(screen.queryByText('app.ts')).toBeNull()
    expect(screen.queryByText('lib')).toBeNull()
    fireEvent.click(folder('src'))
    await waitFor(() => expect(screen.getByText('app.ts')).toBeTruthy())
    expect(screen.queryByText('util.ts')).toBeNull()
    fireEvent.click(folder('src'))
    await waitFor(() => expect(screen.queryByText('app.ts')).toBeNull())
  })

  test('clicking a file ticks it into the Context; a picked file shows ticked', async () => {
    const onToggle = vi.fn()
    const { rerender } = render(<FileTree projectId="p1" context={context([], onToggle)} />)
    fireEvent.click(await screen.findByText('README.md'))
    expect(onToggle).toHaveBeenCalledWith('README.md')
    rerender(<FileTree projectId="p1" context={context(['README.md'], onToggle)} />)
    expect(screen.getByText('README.md').closest('button')!.className).toContain('text-primary')
  })
})
