import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithHost as render } from './test-host.js'

const readProject = vi.fn(async () => ({ files: [], changes: {} }) as unknown)
const readTree = vi.fn(async () => ({ source: 'checkout', files: [], changes: {}, merged: false }) as unknown)
const readDiff = vi.fn(async () => null as unknown)
vi.mock('./reads.js', () => ({ readProject, readTree, readDiff, readContent: vi.fn() }))

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
  readDiff.mockResolvedValue({ path: 'src/app.ts', status: 'modified', patch: '@@ -1 +1 @@\n-const b = 2\n+const b = 3', added: 1, removed: 1, truncated: false, binary: false })
})
afterEach(cleanup)

describe('ChangesPanel', () => {
  test('a run’s page lists only the files the run changed, each with what happened to it, and says they are not merged yet', async () => {
    render(<ChangesPanel projectId="p1" agentId="run-1" context={context} />)
    await waitFor(() => expect(screen.getByText('What this run changed. Not merged yet.')).toBeTruthy())
    expect(readTree).toHaveBeenCalledWith(expect.anything(), 'p1', 'run-1')
    expect(readProject).not.toHaveBeenCalled()
    expect(screen.getAllByRole('listitem').map(row => row.textContent)).toEqual(['old.txtdeleted', 'src/app.tsmodified', 'src/new.tsnot committednew'])
    expect(screen.queryByText('README.md')).toBeNull()
  })

  test('a file opens to its diff, read for the run, only once it is opened', async () => {
    render(<ChangesPanel projectId="p1" agentId="run-1" context={context} />)
    const row = await screen.findByRole('button', { name: /app\.ts/ })
    expect(readDiff).not.toHaveBeenCalled()
    fireEvent.click(row)
    await waitFor(() => expect(readDiff).toHaveBeenCalledWith(expect.anything(), 'p1', 'src/app.ts', 'run-1'))
    await waitFor(() => expect(screen.getByText(/const b = 3/)).toBeTruthy())
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
    fireEvent.click(screen.getByRole('button', { name: /README\.md/ }))
    await waitFor(() => expect(readDiff).toHaveBeenCalledWith(expect.anything(), 'p1', 'README.md', undefined))
    cleanup()
    readProject.mockResolvedValue({ files, changes: {} })
    render(<ChangesPanel projectId="p2" context={context} />)
    await waitFor(() => expect(screen.getByText('Nothing is changed in the project’s folder.')).toBeTruthy())
  })
})
