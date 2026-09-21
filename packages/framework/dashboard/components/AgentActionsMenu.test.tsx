import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

// The ⋮ menu subsumes the old WorkspaceActions / Stop / Remove / Delete row, so it pulls the same
// RPC + editor reads; stub them the way WorkspaceActions.test did.
const onGitHostHome = vi.fn(async () => ({ url: 'https://github.com/o/r', name: 'GitHub' }))
const sendOpenInApp = vi.fn(async () => ({ ok: true as const }))
const sendStop = vi.fn(async () => {})
const sendRemoveWorktree = vi.fn(async () => ({ ok: true as const }))
const sendDeleteAgent = vi.fn(async () => ({ ok: true as const }))
vi.mock('../rpc/reads.js', () => ({ onGitHostHome }))
vi.mock('../rpc/control.js', () => ({
  sendOpenInApp,
  sendStop,
  sendRemoveWorktree,
  sendDeleteAgent,
}))
vi.mock('../lib/preferences.js', () => ({ usePreferences: () => ({}), updatePreferences: vi.fn() }))
vi.mock('../lib/editors.js', () => ({ useDetectedEditors: () => [] }))

const { AgentActionsMenu } = await import('./AgentActionsMenu.js')

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: /session actions/i }))

beforeEach(() => {
  sendOpenInApp.mockClear()
  sendDeleteAgent.mockClear()
})
afterEach(cleanup)

describe('AgentActionsMenu (#toolbar-menu)', () => {
  test('folds the session actions into one menu', async () => {
    render(<AgentActionsMenu projectId="p1" agentId="run-1" events={[]} label="my session" onDeleted={vi.fn()} />)
    openMenu()
    await waitFor(() => expect(screen.getByText('Open on GitHub')).toBeTruthy())
    // No retained worktree here, so the folder item names the project root it will actually open.
    expect(screen.getByText('Open project folder')).toBeTruthy()
    expect(screen.getByText('Open in editor')).toBeTruthy()
    expect(screen.getByText('Delete session')).toBeTruthy()
  })

  test('opening the folder addresses this session, whichever checkout it resolves to', async () => {
    render(<AgentActionsMenu projectId="p1" agentId="run-1" events={[]} onDeleted={vi.fn()} />)
    openMenu()
    fireEvent.click(await screen.findByText('Open project folder'))
    await waitFor(() => expect(sendOpenInApp).toHaveBeenCalledWith('p1', 'files', 'run-1'))
  })

  test("names the folder item for what it opens once the session's worktree is gone (#1195)", async () => {
    // A finished, non-retained run has no checkout of its own, so the item resolves to the project
    // root. Promising "the session's folder" there was a lie the user could not see.
    render(<AgentActionsMenu projectId="p1" agentId="run-1" events={[]} onDeleted={vi.fn()} />)
    openMenu()
    expect(await screen.findByText('Open project folder')).toBeTruthy()
    expect(screen.queryByText("Open session's folder")).toBeNull()
    cleanup()

    // A retained worktree still exists, so the session wording is honest again.
    render(<AgentActionsMenu projectId="p1" agentId="run-1" events={[]} retainedWorktree onDeleted={vi.fn()} />)
    openMenu()
    expect(await screen.findByText("Open session's folder")).toBeTruthy()
  })

  test('copies the command that reopens the session in a terminal (#1195)', async () => {
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    const events = [
      { kind: 'session', driver: 'claude', workspace: '/repo/.the-framework/worktrees/run-1', fake: false },
      { kind: 'session-update', sessionId: '45015d11-755b-423c-ae71-8dbfd54f7cce' },
    ] as never
    render(<AgentActionsMenu projectId="p1" agentId="run-1" events={events} onDeleted={vi.fn()} />)
    openMenu()
    // The id is visible in its own right: it is the only handle on the conversation off-dashboard.
    expect(await screen.findByText('45015d11')).toBeTruthy()
    fireEvent.click(screen.getByText('Copy resume command'))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "mkdir -p '/repo/.the-framework/worktrees/run-1' && cd '/repo/.the-framework/worktrees/run-1' && claude --resume 45015d11-755b-423c-ae71-8dbfd54f7cce",
      ),
    )
    // And it says so, since a click that only fills the clipboard shows nothing otherwise.
    await waitFor(() => expect(screen.getByText('Copied')).toBeTruthy())
  })

  test('offers nothing to copy for a run that never reported a session', async () => {
    render(<AgentActionsMenu projectId="p1" agentId="run-1" events={[]} onDeleted={vi.fn()} />)
    openMenu()
    await waitFor(() => expect(screen.getByText('Open in editor')).toBeTruthy())
    expect(screen.queryByText('Copy resume command')).toBeNull()
    expect(screen.queryByText('Copy session id')).toBeNull()
  })

  test('Delete asks to confirm before deleting', async () => {
    const onDeleted = vi.fn()
    render(<AgentActionsMenu projectId="p1" agentId="run-1" events={[]} label="my session" onDeleted={onDeleted} />)
    openMenu()
    fireEvent.click(await screen.findByText('Delete session'))
    // The confirm dialog, not a bare delete: the session and its history go for good.
    await waitFor(() => expect(screen.getByText('Delete this agent?')).toBeTruthy())
    expect(sendDeleteAgent).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(sendDeleteAgent).toHaveBeenCalledWith('p1', 'run-1'))
  })
})

describe('the live-session action: Stop', () => {
  const liveEvents = [{ kind: 'session-update', sessionId: 'working' }] as never

  test('a live session offers Stop, and no Merge: a run that is working publishes its own work', async () => {
    render(<AgentActionsMenu projectId="p1" agentId="run-1" events={liveEvents} onDeleted={vi.fn()} />)
    openMenu()
    await waitFor(() => expect(screen.getByText('Stop agent')).toBeTruthy())
    expect(screen.queryByText(/Merge/)).toBeNull()
  })

  test('an ended session offers no Stop', async () => {
    const ended = [{ kind: 'session-update', sessionId: 'working' }, { kind: 'end', ok: true }] as never
    render(<AgentActionsMenu projectId="p1" agentId="run-1" events={ended} onDeleted={vi.fn()} />)
    openMenu()
    await waitFor(() => expect(screen.getByText('Open in editor')).toBeTruthy())
    expect(screen.queryByText('Stop agent')).toBeNull()
  })
})
