import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const onGitStatus = vi.fn(async () => null as unknown)
const onAgentWorktree = vi.fn(async (..._args: unknown[]) => null as unknown)
vi.mock('../rpc/reads.js', () => ({ onGitStatus, onAgentWorktree }))

const { GitStatusBar } = await import('./GitStatusBar.js')

beforeEach(() => {
  onGitStatus.mockClear()
  onAgentWorktree.mockClear()
})
afterEach(cleanup)

describe('GitStatusBar (#809)', () => {
  test('the project home reads the project checkout', async () => {
    onGitStatus.mockResolvedValue({ branch: 'main', dirty: false })
    render(<GitStatusBar projectId="p1" inline />)
    await waitFor(() => expect(screen.getByText('main')).toBeTruthy())
    expect(screen.getByText('clean')).toBeTruthy()
    expect(onAgentWorktree).not.toHaveBeenCalled()
  })

  test("a session reads its own worktree, and reports what only a worktree has", async () => {
    onAgentWorktree.mockResolvedValue({
      checkout: { path: '/repo/.the-framework/worktrees/run-1', dirty: true, sizeBytes: 5 * 1024 * 1024 },
      branch: 'the-framework/dark-mode',
    })
    render(<GitStatusBar projectId="p1" agentId="run-1" inline />)
    await waitFor(() => expect(screen.getByText('the-framework/dark-mode')).toBeTruthy())
    expect(screen.getByText('dirty')).toBeTruthy()
    expect(screen.getByText('5 MB')).toBeTruthy()
    expect(onGitStatus).not.toHaveBeenCalled()
  })

  test("an agent's page: the name, clean or dirty; its branch and its pull request are not said here", async () => {
    onAgentWorktree.mockResolvedValue({ checkout: { path: '/repo/.branches/run-1', dirty: true }, branch: 'agent-dark-mode', pr: { number: 12, url: 'https://github.com/o/r/pull/12', state: 'OPEN', title: 'Dark mode' } })
    render(<GitStatusBar projectId="p1" agentId="run-1" inline label="Dark mode" />)
    await waitFor(() => expect(screen.getByText('dirty')).toBeTruthy())
    expect(screen.getByText('Dark mode')).toBeTruthy()
    expect(screen.queryByText('agent-dark-mode')).toBeNull()
    expect(screen.queryByText(/PR #12/)).toBeNull()
  })

  test('given the checkout by its caller, it reads nothing itself', async () => {
    const { rerender } = render(<GitStatusBar projectId="p1" agentId="run-1" inline label="Dark mode" checkout={null} />)
    expect(screen.queryByText(/clean|dirty/)).toBeNull()
    rerender(<GitStatusBar projectId="p1" agentId="run-1" inline label="Dark mode" checkout={{ checkout: { path: '/w', dirty: false }, branch: 'b' }} />)
    expect(screen.getByText('clean')).toBeTruthy()
    expect(onAgentWorktree).not.toHaveBeenCalled()
    expect(onGitStatus).not.toHaveBeenCalled()
  })

  test('beside a long session name the project stays, capped, and the session name is what gets cut', async () => {
    onAgentWorktree.mockResolvedValue({ checkout: { path: '/repo/.branches/run-1', dirty: false }, branch: 'agent-run-1' })
    const long = "Read packages/framework/package.json and tell me the package's name and how it builds"
    render(<GitStatusBar projectId="p1" agentId="run-1" inline label={long} projectName="gemstack" />)
    await waitFor(() => expect(screen.getByText('gemstack')).toBeTruthy())
    // No layout in the test DOM, so the rule is read off the classes: the project keeps its width
    // up to a cap (it used to give up width first, and vanished beside a long name).
    const crumb = screen.getByTestId('project-crumb')
    expect(crumb.className).toContain('shrink-0')
    expect(crumb.className).toContain('max-w-32')
    expect(screen.getByText('gemstack').className).toContain('truncate')
    expect(screen.getByTitle(long).className).toContain('truncate')
  })

  test('the project and a command-named session are separated by ›, never a doubled slash', async () => {
    onAgentWorktree.mockResolvedValue({ checkout: { path: '/repo/.branches/run-1', dirty: false }, branch: 'agent-run-1' })
    render(<GitStatusBar projectId="p1" agentId="run-1" inline label="/update-tickets" projectName="gemstack" />)
    await waitFor(() => expect(screen.getByText('/update-tickets')).toBeTruthy())
    expect(screen.getByTestId('project-crumb').textContent).toBe('gemstack›')
  })

  test('the session name shows from the first frame; its facts wait for its own read, and for ready', async () => {
    let answer: (v: unknown) => void = () => {}
    onAgentWorktree.mockReturnValue(new Promise(resolve => (answer = resolve)))
    const { rerender } = render(<GitStatusBar projectId="p1" agentId="run-1" inline label="Fix the header" projectName="gemstack" ready={false} />)
    expect(screen.getByText('Fix the header')).toBeTruthy()
    expect(screen.queryByText('clean')).toBeNull()
    answer({ checkout: { path: '/repo/.branches/run-1', dirty: false }, branch: 'agent-run-1' })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(screen.queryByText('clean')).toBeNull() // read, but the caller's facts are not in yet
    rerender(<GitStatusBar projectId="p1" agentId="run-1" inline label="Fix the header" projectName="gemstack" ready />)
    await waitFor(() => expect(screen.getByText('clean')).toBeTruthy())
  })

  test('the disclosure chevron is there before the facts are, so the name never moves when they land', async () => {
    onAgentWorktree.mockReturnValue(new Promise(() => {}))
    render(<GitStatusBar projectId="p1" agentId="run-1" inline label="Fix the header" onToggle={() => {}} ready={false} />)
    const chevron = screen.getByTestId('disclosure-chevron')
    // Before the name, as in the disclosure the facts come in.
    expect(chevron.compareDocumentPosition(screen.getByText('Fix the header')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    cleanup()
    // Without a disclosure there is nothing to open, so no chevron either way.
    render(<GitStatusBar projectId="p1" agentId="run-1" inline label="Fix the header" ready={false} />)
    expect(screen.queryByTestId('disclosure-chevron')).toBeNull()
  })

  test("switching sessions never shows the previous session's facts; going back shows its own at once", async () => {
    onAgentWorktree.mockImplementation(async (_p: unknown, id: unknown) => ({ checkout: { path: `/repo/.branches/${id}`, dirty: id === 'run-1' }, branch: `agent-${id}` }))
    const { rerender } = render(<GitStatusBar projectId="p1" agentId="run-1" inline label="One" />)
    await waitFor(() => expect(screen.getByText('dirty')).toBeTruthy())
    onAgentWorktree.mockImplementation(() => new Promise(() => {}))
    rerender(<GitStatusBar projectId="p1" agentId="run-2" inline label="Two" />)
    expect(screen.getByText('Two')).toBeTruthy()
    expect(screen.queryByText('dirty')).toBeNull() // run-1's fact, not shown as run-2's
    rerender(<GitStatusBar projectId="p1" agentId="run-1" inline label="One" />)
    expect(screen.getByText('dirty')).toBeTruthy() // remembered, from the first frame
  })

  test("a session's PR shows, the way the project's does", async () => {
    // A session's branch is exactly the thing that has a PR, so hiding it there made the one
    // page where it matters most the page without it.
    onAgentWorktree.mockResolvedValue({
      checkout: { path: '/repo/wt', dirty: false },
      branch: 'the-framework/dark-mode',
      pr: { number: 42, url: 'https://github.com/o/r/pull/42', state: 'OPEN', title: 'Dark mode' },
    })
    render(<GitStatusBar projectId="p1" agentId="run-1" inline />)
    await waitFor(() => expect(screen.getByText('PR #42')).toBeTruthy())
    expect(screen.getByText('open')).toBeTruthy()
  })

  test('the size is omitted while it cannot be read', async () => {
    // A live session is being written to, so the server does not price it; the row must not
    // show a stray placeholder where the number would go.
    onAgentWorktree.mockResolvedValue({ checkout: { path: '/repo/wt', dirty: false }, branch: 'b' })
    const { container } = render(<GitStatusBar projectId="p1" agentId="run-1" inline />)
    await waitFor(() => expect(screen.getByText('b')).toBeTruthy())
    expect(container.textContent).not.toContain('–')
  })

  test("a session whose checkout is gone shows its recorded branch, and no clean or dirty", async () => {
    // Its checkout was reclaimed, so there is no tree to be either: the user's own checkout's
    // branch and "clean" used to stand in for it.
    onAgentWorktree.mockResolvedValue({ branch: 'agent-run-1' })
    render(<GitStatusBar projectId="p1" agentId="run-1" inline />)
    await waitFor(() => expect(screen.getByText('agent-run-1')).toBeTruthy())
    expect(screen.queryByText('clean')).toBeNull()
    expect(screen.queryByText('dirty')).toBeNull()
  })

  test('nothing renders when there is no checkout to report', async () => {
    onAgentWorktree.mockResolvedValue(null)
    const { container } = render(<GitStatusBar projectId="p1" agentId="gone" inline />)
    await waitFor(() => expect(onAgentWorktree).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })
})
