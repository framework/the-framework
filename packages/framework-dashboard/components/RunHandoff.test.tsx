import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const onRunHandoff = vi.fn(async () => null as unknown)
const sendPushBranch = vi.fn(async () => ({ ok: true }) as unknown)
const sendOpenPullRequest = vi.fn(async () => ({ ok: true }) as unknown)
const sendSetHandoff = vi.fn(async () => undefined as unknown)
vi.mock('../server/reads.telefunc.js', () => ({ onRunHandoff }))
vi.mock('../server/control.telefunc.js', () => ({ sendPushBranch, sendOpenPullRequest, sendSetHandoff }))

const { HandoffActions, HandoffArm, HandoffSummary, RunHandoffDetails, handoffExpandable } = await import('./RunHandoff.js')
const { useRunHandoff } = await import('../lib/use-run-handoff.js')

/** A handoff for a session that did real work, on a repo with a remote and no PR yet. */
const worked = {
  branch: 'the-framework/dark-mode',
  exists: true,
  base: 'origin/main',
  commits: [{ sha: 'aaaaaaa1', short: 'aaaaaaa', subject: 'add dark mode' }],
  files: [{ path: 'src/theme.ts', insertions: 12, deletions: 3, binary: false }],
  insertions: 12,
  deletions: 3,
  empty: false,
  hasRemote: true,
  pushed: false,
  merged: false,
}

// The same composition RunView uses: the verdict and the next step in the action bar, the
// commits and files behind the bar's disclosure.
function Harness({ open = true }: { open?: boolean }) {
  const state = useRunHandoff('p1', 'run-1')
  return (
    <>
      <HandoffSummary handoff={state.handoff} />
      {state.error && <span>{state.error}</span>}
      <HandoffActions projectId="p1" runId="run-1" state={state} />
      {open && handoffExpandable(state.handoff) && <RunHandoffDetails handoff={state.handoff} />}
    </>
  )
}

beforeEach(() => {
  onRunHandoff.mockClear()
  sendPushBranch.mockClear()
  sendOpenPullRequest.mockClear()
  sendOpenPullRequest.mockResolvedValue({ ok: true })
  sendSetHandoff.mockClear()
  sendSetHandoff.mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('run handoff (#799)', () => {
  test('summarises what a finished session produced, and lists it when expanded', async () => {
    onRunHandoff.mockResolvedValue(worked)
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('1 commit')).toBeTruthy())
    expect(screen.getByText('1 file')).toBeTruthy()
    expect(screen.getByText('add dark mode')).toBeTruthy()
    expect(screen.getByText('src/theme.ts')).toBeTruthy()
  })

  test('collapsed, it still says what the branch holds — without the lists (#1023)', async () => {
    onRunHandoff.mockResolvedValue(worked)
    render(<Harness open={false} />)
    await waitFor(() => expect(screen.getByText('1 commit')).toBeTruthy())
    expect(screen.queryByText('add dark mode')).toBeNull()
    expect(screen.queryByText('src/theme.ts')).toBeNull()
    // The next step is never hidden behind the disclosure.
    expect(screen.getByText('Open PR')).toBeTruthy()
  })

  test('the branch name is not repeated — the action bar it sits in already says it (#1023)', async () => {
    onRunHandoff.mockResolvedValue(worked)
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('1 commit')).toBeTruthy())
    expect(screen.queryByText('the-framework/dark-mode')).toBeNull()
  })

  test('a session that changed nothing says so, and has nothing to expand', async () => {
    onRunHandoff.mockResolvedValue({ ...worked, commits: [], files: [], insertions: 0, deletions: 0, empty: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('no changes')).toBeTruthy())
    expect(handoffExpandable({ ...worked, empty: true } as never)).toBe(false)
    // Nothing to hand off, so no button — but it says why (#1173). A finished session showing no
    // control and no sentence is exactly the dead end that made "what should I do now?" unanswerable.
    expect(screen.queryByText('Open PR')).toBeNull()
    expect(screen.getByText('Nothing committed — no PR to open.')).toBeTruthy()
  })

  test('a branch that is gone is reported, not shown as work', async () => {
    onRunHandoff.mockResolvedValue({ ...worked, exists: false, commits: [], files: [], empty: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('branch gone')).toBeTruthy())
    expect(screen.queryByText('Open PR')).toBeNull()
    expect(screen.getByText('Branch gone — nothing to open a PR from.')).toBeTruthy()
  })

  test('push is offered only while the branch is unpushed', async () => {
    onRunHandoff.mockResolvedValue({ ...worked, pushed: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Open PR')).toBeTruthy())
    expect(screen.queryByText('Push branch')).toBeNull()
  })

  test('one button, and it opens the PR — pushing is not a competing choice (#1173)', async () => {
    // "Push branch" and "Open PR" used to sit side by side as equals, and pushing without opening
    // a PR is a step neither of us could put a purpose to. Opening a PR pushes on the way, so the
    // one that names the outcome is the one that is offered.
    onRunHandoff.mockResolvedValue(worked)
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Open PR')).toBeTruthy())
    expect(screen.queryByText('Push branch')).toBeNull()
    fireEvent.click(screen.getByText('Open PR'))
    await waitFor(() => expect(sendOpenPullRequest).toHaveBeenCalledWith('p1', 'run-1'))
    expect(sendPushBranch).not.toHaveBeenCalled()
  })

  test('a failed action surfaces its reason rather than doing nothing', async () => {
    onRunHandoff.mockResolvedValue(worked)
    sendOpenPullRequest.mockResolvedValue({ ok: false, error: 'gh: not logged in' })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Open PR')).toBeTruthy())
    fireEvent.click(screen.getByText('Open PR'))
    await waitFor(() => expect(screen.getByText('gh: not logged in')).toBeTruthy())
  })

  test('an existing PR withdraws the offer — the bar links it instead (#632)', async () => {
    onRunHandoff.mockResolvedValue({
      ...worked,
      pushed: true,
      pr: { number: 42, url: 'https://example.test/42', state: 'OPEN', title: 'Add dark mode' },
    })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('1 commit')).toBeTruthy())
    expect(screen.queryByText('Open PR')).toBeNull()
    expect(screen.queryByText('Push branch')).toBeNull()
  })

  test('a repo with no remote says why instead of offering a dead button', async () => {
    onRunHandoff.mockResolvedValue({ ...worked, hasRemote: false })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText(/No remote to push to/)).toBeTruthy())
    expect(screen.queryByText('Push branch')).toBeNull()
  })

  test('nothing is rendered before the first read, so no wrong empty state flashes', () => {
    onRunHandoff.mockReturnValue(new Promise(() => {}) as never)
    const { container } = render(<Harness />)
    expect(container.textContent).toBe('')
  })
})

describe('the handoff checkboxes (#1102)', () => {
  const armed = { push: true, pr: true }

  test('one ticked box, so a session left alone hands itself back (#1102/#1173)', () => {
    render(<HandoffArm projectId="p1" runId="run-1" state={armed} />)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(1)
    expect(screen.getByText('Open PR')).toBeTruthy()
    expect(screen.queryByText('Push branch')).toBeNull()
    expect(boxes[0]?.getAttribute('data-checked')).not.toBeNull()
  })

  test('unticking it means the session hands off nothing at all (#1173)', async () => {
    // One control governs the whole end-of-session step, so what the box says is what happens.
    // It used to leave the push armed, which is a thing still happening that nothing on screen said.
    render(<HandoffArm projectId="p1" runId="run-1" state={armed} />)
    fireEvent.click(screen.getByText('Open PR'))
    await waitFor(() => expect(sendSetHandoff).toHaveBeenCalledWith('p1', 'run-1', false, false))
  })

  test('ticking it arms the push too, since opening a PR needs the branch on the remote', async () => {
    render(<HandoffArm projectId="p1" runId="run-1" state={{ push: false, pr: false }} />)
    fireEvent.click(screen.getByText('Open PR'))
    await waitFor(() => expect(sendSetHandoff).toHaveBeenCalledWith('p1', 'run-1', true, true))
  })

  test('a push-only session says "Push branch", rather than an unticked box while it pushes (#1173)', () => {
    // Reachable from the settings, where push and PR are still separate. The one box names whatever
    // this session will actually do, so it is never describing something other than what happens.
    render(<HandoffArm projectId="p1" runId="run-1" state={{ push: true, pr: false }} />)
    expect(screen.getByText('Push branch')).toBeTruthy()
    expect(screen.getAllByRole('checkbox')[0]?.getAttribute('data-checked')).not.toBeNull()
  })

  test('the click holds until the run echoes it back, so the box does not bounce', async () => {
    // The instruction round-trips through a file the run tails, so the events lag the click by a
    // beat. Rendering the stale value in that window would flick the box back on under the cursor.
    const { rerender } = render(<HandoffArm projectId="p1" runId="run-1" state={armed} />)
    fireEvent.click(screen.getByText('Open PR'))
    await waitFor(() => expect(sendSetHandoff).toHaveBeenCalled())
    rerender(<HandoffArm projectId="p1" runId="run-1" state={armed} />)
    expect(screen.getAllByRole('checkbox')[0]?.getAttribute('data-checked')).toBeNull()
  })
})
