import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const onProjectFileStatus = vi.fn(async () => ({}) as unknown)
const onAgentTree = vi.fn(async () => ({ source: 'checkout', files: [], changes: {} }) as unknown)
vi.mock('../rpc/reads.js', () => ({ onProjectFileStatus, onAgentTree }))

const { FileTree } = await import('./FileTree.js')

const noop = () => {}
const files = ['src/app.ts', 'README.md']

beforeEach(() => {
  onProjectFileStatus.mockClear()
  onProjectFileStatus.mockResolvedValue({})
  onAgentTree.mockClear()
  onAgentTree.mockResolvedValue({ source: 'checkout', files, changes: {} })
})
afterEach(cleanup)

describe('FileTree (#815)', () => {
  test('the project home reads the project checkout', async () => {
    render(<FileTree projectId="p1" files={files} selected={new Set()} onToggle={noop} />)
    await waitFor(() => expect(onProjectFileStatus).toHaveBeenCalledWith('p1'))
    expect(onAgentTree).not.toHaveBeenCalled()
  })

  test("a session's tree is the session's own, not the project's", async () => {
    // The action bar right above the tree has resolved the worktree since #738. Reading the
    // project root here put a clean branch next to another checkout's M/U/D dots.
    onAgentTree.mockResolvedValue({ source: 'checkout', files: ['only-in-run.ts'], changes: {} })
    render(<FileTree projectId="p1" agentId="run-1" files={files} selected={new Set()} onToggle={noop} />)
    await waitFor(() => expect(screen.getByText('only-in-run.ts')).toBeTruthy())
    expect(onAgentTree).toHaveBeenCalledWith('p1', 'run-1')
    expect(onProjectFileStatus).not.toHaveBeenCalled()
    expect(screen.queryByText('README.md')).toBeNull()
  })

  test('switching session re-reads, rather than keeping the previous one’s marks', async () => {
    const { rerender } = render(
      <FileTree projectId="p1" agentId="run-1" files={files} selected={new Set()} onToggle={noop} />,
    )
    await waitFor(() => expect(onAgentTree).toHaveBeenCalledWith('p1', 'run-1'))
    rerender(<FileTree projectId="p1" agentId="run-2" files={files} selected={new Set()} onToggle={noop} />)
    await waitFor(() => expect(onAgentTree).toHaveBeenCalledWith('p1', 'run-2'))
  })

  test('a changed file shows its letter, committed and uncommitted drawn apart', async () => {
    onAgentTree.mockResolvedValue({
      source: 'checkout',
      files,
      changes: { 'README.md': { status: 'modified', committed: false }, 'src/app.ts': { status: 'added', committed: true } },
    })
    render(<FileTree projectId="p1" agentId="run-1" files={files} selected={new Set()} onToggle={noop} />)
    await waitFor(() => expect(screen.getByLabelText('modified, not committed')).toBeTruthy())
    expect(screen.getByLabelText('added, committed').textContent).toBe('A')
    expect(screen.getByText('From the run’s checkout')).toBeTruthy()
  })

  test('a finished run with no checkout is read from its branch, then its merge, and says which', async () => {
    onAgentTree.mockResolvedValue({ source: 'branch', branch: 'agent-fix', files, changes: {} })
    const { rerender } = render(<FileTree projectId="p1" agentId="run-1" files={[]} selected={new Set()} onToggle={noop} />)
    await waitFor(() => expect(screen.getByText('From branch agent-fix')).toBeTruthy())
    onAgentTree.mockResolvedValue({ source: 'merge', number: 42, files, changes: {} })
    rerender(<FileTree projectId="p1" agentId="run-2" files={[]} selected={new Set()} onToggle={noop} />)
    await waitFor(() => expect(screen.getByText('From the merge of #42')).toBeTruthy())
  })

  test('a run whose changes are gone says so, instead of showing the project unmarked', async () => {
    onAgentTree.mockResolvedValue({ source: 'gone' })
    render(<FileTree projectId="p1" agentId="run-1" files={files} selected={new Set()} onToggle={noop} />)
    await waitFor(() => expect(screen.getByText(/This run’s changes are gone from this machine/)).toBeTruthy())
    expect(screen.queryByText('README.md')).toBeNull()
  })

  test('clicking a file ticks it into the Context; a picked file shows ticked', async () => {
    const onToggle = vi.fn()
    const { rerender } = render(<FileTree projectId="p1" files={files} selected={new Set()} onToggle={onToggle} />)
    fireEvent.click(screen.getByText('README.md'))
    expect(onToggle).toHaveBeenCalledWith('README.md')
    rerender(<FileTree projectId="p1" files={files} selected={new Set(['README.md'])} onToggle={onToggle} />)
    expect(screen.getByText('README.md').closest('button')!.className).toContain('text-primary')
  })
})
