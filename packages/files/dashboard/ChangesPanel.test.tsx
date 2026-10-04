import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithHost as render } from './test-host.js'

const readProject = vi.fn(async () => ({ files: [], changes: {} }) as unknown)
const readTree = vi.fn(async () => ({ source: 'checkout', files: [], changes: {}, merged: false }) as unknown)
const readDiff = vi.fn(async () => null as unknown)
const readCommits = vi.fn(async () => [] as unknown)
const readCommit = vi.fn(async () => null as unknown)
vi.mock('./reads.js', () => ({ readProject, readTree, readDiff, readCommits, readCommit, readContent: vi.fn() }))

const { ChangesPanel } = await import('./ChangesPanel.js')

const context = { files: new Set<string>(), toggle: () => {} }
const files = ['README.md', 'src/app.ts', 'src/new.ts']
const changes = {
  'src/app.ts': { status: 'modified', committed: true },
  'src/new.ts': { status: 'untracked', committed: false },
  'old.txt': { status: 'deleted', committed: true },
}

beforeEach(() => {
  vi.clearAllMocks()
  readProject.mockResolvedValue({ files, changes: {} })
  readTree.mockResolvedValue({ source: 'checkout', files, changes, merged: false })
  readCommits.mockResolvedValue([])
  readCommit.mockResolvedValue(null)
  readDiff.mockResolvedValue({ path: 'src/app.ts', status: 'modified', patch: '@@ -1 +1 @@\n-const b = 2\n+const b = 3', added: 1, removed: 1, truncated: false, binary: false })
})
afterEach(cleanup)

describe('ChangesPanel', () => {
  test('a run’s page lists only the files the run changed, each with what happened to it, and says they are not merged yet', async () => {
    render(<ChangesPanel projectId="p1" agentId="run-1" context={context} />)
    await waitFor(() => expect(screen.getByText('What this run changed. Not merged yet.')).toBeTruthy())
    expect(readTree).toHaveBeenCalledWith(expect.anything(), 'p1', 'run-1')
    expect(readProject).not.toHaveBeenCalled()
    expect(within(screen.getByRole('list', { name: 'Changed files' })).getAllByRole('listitem').map(row => row.textContent)).toEqual(['old.txtdeleted', 'src/app.tsmodified', 'src/new.tsnew · not committed'])
    expect(screen.queryByText('README.md')).toBeNull()
  })

  test('the first file is picked by itself and its diff shows beside the list; a click on another file shows that one', async () => {
    render(<ChangesPanel projectId="p1" agentId="run-1" context={context} />)
    const first = await screen.findByRole('button', { name: /old\.txt/ })
    expect(first.getAttribute('aria-pressed')).toBe('true')
    await waitFor(() => expect(readDiff).toHaveBeenCalledWith(expect.anything(), 'p1', 'old.txt', 'run-1', undefined))
    expect(readDiff).toHaveBeenCalledTimes(1)
    const row = screen.getByRole('button', { name: /app\.ts/ })
    expect(row.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(row)
    await waitFor(() => expect(readDiff).toHaveBeenCalledWith(expect.anything(), 'p1', 'src/app.ts', 'run-1', undefined))
    expect(row.getAttribute('aria-pressed')).toBe('true')
    expect(first.getAttribute('aria-pressed')).toBe('false')
    await waitFor(() => expect(screen.getByText(/const b = 3/)).toBeTruthy())
  })

  test('when the picked file leaves the list, the first file is picked again', async () => {
    const { rerender } = render(<ChangesPanel projectId="p1" agentId="run-1" context={context} activity={1} />)
    fireEvent.click(await screen.findByRole('button', { name: /new\.ts/ }))
    readTree.mockResolvedValue({ source: 'checkout', files, changes: { 'src/app.ts': changes['src/app.ts'], 'old.txt': changes['old.txt'] }, merged: false })
    rerender(<ChangesPanel projectId="p1" agentId="run-1" context={context} activity={2} />)
    await waitFor(() => expect(screen.queryByRole('button', { name: /new\.ts/ })).toBeNull())
    expect(screen.getByRole('button', { name: /old\.txt/ }).getAttribute('aria-pressed')).toBe('true')
  })

  test('a click counts for the run it was made on: another run with the same file starts at its own first file', async () => {
    const { rerender } = render(<ChangesPanel projectId="p1" agentId="run-1" context={context} />)
    fireEvent.click(await screen.findByRole('button', { name: /app\.ts/ }))
    rerender(<ChangesPanel projectId="p1" agentId="run-2" context={context} />)
    await waitFor(() => expect(readTree).toHaveBeenCalledWith(expect.anything(), 'p1', 'run-2'))
    await waitFor(() => expect(screen.getByRole('button', { name: /old\.txt/ }).getAttribute('aria-pressed')).toBe('true'))
    expect(screen.getByRole('button', { name: /app\.ts/ }).getAttribute('aria-pressed')).toBe('false')
  })

  test('a merged run keeps its list, and says it is merged', async () => {
    readTree.mockResolvedValue({ source: 'landed', files, changes: { 'src/app.ts': { status: 'modified', committed: true } }, merged: true })
    render(<ChangesPanel projectId="p1" agentId="run-1" context={context} />)
    await waitFor(() => expect(screen.getByText('What this run changed. Merged.')).toBeTruthy())
    expect(screen.getByRole('button', { name: /app\.ts/ })).toBeTruthy()
  })

  test('a run that changed nothing, a run whose changes are gone, and a run still being read each say so in one line', async () => {
    readTree.mockResolvedValue({ source: 'unchanged', files, changes: {} })
    render(<ChangesPanel projectId="p1" agentId="run-1" context={context} />)
    await waitFor(() => expect(screen.getByText('This run changed no files.')).toBeTruthy())
    cleanup()
    readTree.mockResolvedValue({ source: 'gone' })
    render(<ChangesPanel projectId="p1" agentId="run-2" context={context} />)
    await waitFor(() => expect(screen.getByText(/gone from this machine/)).toBeTruthy())
    cleanup()
    readTree.mockResolvedValue({ source: 'pending' })
    render(<ChangesPanel projectId="p1" agentId="run-3" context={context} />)
    await waitFor(() => expect(readTree).toHaveBeenCalledWith(expect.anything(), 'p1', 'run-3'))
    expect(screen.getByText('Looking for this run’s changes…')).toBeTruthy()
  })

  test('the project’s own page lists what is changed in its folder and not committed, or says nothing is', async () => {
    readProject.mockResolvedValue({ files, changes: { 'README.md': { status: 'modified', committed: false } } })
    render(<ChangesPanel projectId="p1" context={context} />)
    await waitFor(() => expect(screen.getByText('Changed in the project’s folder, not committed.')).toBeTruthy())
    expect(readTree).not.toHaveBeenCalled()
    await waitFor(() => expect(readDiff).toHaveBeenCalledWith(expect.anything(), 'p1', 'README.md', undefined, undefined))
    cleanup()
    readProject.mockResolvedValue({ files, changes: {} })
    render(<ChangesPanel projectId="p2" context={context} />)
    await waitFor(() => expect(screen.getByText('Nothing is changed in the project’s folder.')).toBeTruthy())
  })
})

describe('ChangesPanel commits', () => {
  const NEW = { sha: 'b'.repeat(40), short: 'bbbbbbb', subject: 'Change the app', author: 'Agent', date: new Date(Date.now() - 2 * 3_600_000).toISOString() }
  const OLD = { sha: 'a'.repeat(40), short: 'aaaaaaa', subject: 'Add old.txt', author: 'Agent', date: new Date(Date.now() - 3 * 3_600_000).toISOString() }
  const commitRows = () => within(screen.getByRole('region', { name: 'Commits' })).getAllByRole('button')

  beforeEach(() => {
    readCommits.mockResolvedValue([NEW, OLD])
    readCommit.mockResolvedValue({ 'src/app.ts': { status: 'modified', committed: true } })
  })

  test('the run’s commits are under the file list, newest first, with "All changes" above them and picked', async () => {
    render(<ChangesPanel projectId="p1" agentId="run-1" context={context} />)
    await waitFor(() => expect(commitRows()).toHaveLength(3))
    expect(readCommits).toHaveBeenCalledWith(expect.anything(), 'p1', 'run-1')
    expect(commitRows().map(row => row.textContent)).toEqual(['All changes', 'Change the appbbbbbbb · Agent · 2h ago', 'Add old.txtaaaaaaa · Agent · 3h ago'])
    expect(commitRows().map(row => row.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    expect(screen.getByRole('region', { name: 'Commits' }).textContent).toContain('Commits2')
    expect(readCommit).not.toHaveBeenCalled()
  })

  test('a click on a commit shows only that commit: its name, its files, its own diff; "All changes" goes back', async () => {
    render(<ChangesPanel projectId="p1" agentId="run-1" context={context} />)
    await waitFor(() => expect(commitRows()).toHaveLength(3))
    fireEvent.click(commitRows()[1]!)
    await waitFor(() => expect(readCommit).toHaveBeenCalledWith(expect.anything(), 'p1', 'run-1', NEW.sha))
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Changed files' })).getAllByRole('listitem').map(row => row.textContent)).toEqual(['src/app.tsmodified']))
    expect(screen.getByText('bbbbbbb Change the app')).toBeTruthy()
    expect(screen.queryByText('What this run changed. Not merged yet.')).toBeNull()
    await waitFor(() => expect(readDiff).toHaveBeenCalledWith(expect.anything(), 'p1', 'src/app.ts', 'run-1', NEW.sha))
    expect(commitRows().map(row => row.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])

    fireEvent.click(commitRows()[0]!)
    await waitFor(() => expect(screen.getByText('What this run changed. Not merged yet.')).toBeTruthy())
    expect(within(screen.getByRole('list', { name: 'Changed files' })).getAllByRole('listitem')).toHaveLength(3)
    await waitFor(() => expect(readDiff).toHaveBeenLastCalledWith(expect.anything(), 'p1', 'old.txt', 'run-1', undefined))
  })

  test('a picked commit that is no longer one of the run’s gives way to "All changes"', async () => {
    const { rerender } = render(<ChangesPanel projectId="p1" agentId="run-1" context={context} activity={1} />)
    await waitFor(() => expect(commitRows()).toHaveLength(3))
    fireEvent.click(commitRows()[2]!)
    await waitFor(() => expect(screen.getByText('aaaaaaa Add old.txt')).toBeTruthy())
    readCommits.mockResolvedValue([NEW])
    rerender(<ChangesPanel projectId="p1" agentId="run-1" context={context} activity={2} />)
    await waitFor(() => expect(commitRows()).toHaveLength(2))
    expect(screen.getByText('What this run changed. Not merged yet.')).toBeTruthy()
    expect(commitRows()[0]!.getAttribute('aria-pressed')).toBe('true')
  })

  test('commits that leave no change still show, and the place of the diff says they cancel out', async () => {
    readTree.mockResolvedValue({ source: 'checkout', files, changes: {}, merged: false })
    render(<ChangesPanel projectId="p1" agentId="run-1" context={context} />)
    await waitFor(() => expect(commitRows()).toHaveLength(3))
    expect(screen.getByText('No change is left: the commits cancel out.')).toBeTruthy()
    expect(screen.queryByText('This run changed no files.')).toBeNull()
  })

  test('while the run’s files move as it ends, the commits last read stay, and so does the picked commit', async () => {
    const { rerender } = render(<ChangesPanel projectId="p1" agentId="run-1" context={context} activity={1} />)
    await waitFor(() => expect(commitRows()).toHaveLength(3))
    fireEvent.click(commitRows()[1]!)
    await waitFor(() => expect(screen.getByText('bbbbbbb Change the app')).toBeTruthy())
    readTree.mockResolvedValue({ source: 'pending' })
    readCommits.mockResolvedValue([])
    rerender(<ChangesPanel projectId="p1" agentId="run-1" context={context} activity={2} />)
    await waitFor(() => expect(readCommits).toHaveBeenCalledTimes(2))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(commitRows()).toHaveLength(3)
    expect(screen.getByText('bbbbbbb Change the app')).toBeTruthy()
  })

  test('"This run changed no files." is not said before the commits are read', async () => {
    readTree.mockResolvedValue({ source: 'checkout', files, changes: {}, merged: false })
    let answer: (commits: unknown) => void = () => {}
    readCommits.mockReturnValue(new Promise(resolve => (answer = resolve)) as never)
    render(<ChangesPanel projectId="p1" agentId="run-1" context={context} />)
    await waitFor(() => expect(readTree).toHaveBeenCalled())
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(screen.queryByText('This run changed no files.')).toBeNull()
    expect(screen.getByText('Looking for this run’s changes…')).toBeTruthy()
    answer([NEW])
    await waitFor(() => expect(screen.getByText('No change is left: the commits cancel out.')).toBeTruthy())
  })

  test('the project’s own page reads and shows no commits', async () => {
    readProject.mockResolvedValue({ files, changes: { 'README.md': { status: 'modified', committed: false } } })
    render(<ChangesPanel projectId="p1" context={context} />)
    await waitFor(() => expect(screen.getByText('Changed in the project’s folder, not committed.')).toBeTruthy())
    expect(readCommits).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'Commits' })).toBeNull()
  })
})
