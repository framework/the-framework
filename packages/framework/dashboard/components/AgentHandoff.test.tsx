import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const onAgentHandoff = vi.fn(async () => null as unknown)
const sendPushBranch = vi.fn(async () => ({ ok: true }) as unknown)
const sendOpenPullRequest = vi.fn(async () => ({ ok: true }) as unknown)
const sendSetHandoff = vi.fn(async () => undefined as unknown)
const sendMerge = vi.fn(async () => ({ ok: true }) as unknown)
vi.mock('../rpc/reads.js', () => ({ onAgentHandoff }))
vi.mock('../rpc/control.js', () => ({ sendPushBranch, sendOpenPullRequest, sendSetHandoff, sendMerge }))

const { HandoffActions, HandoffArm, HandoffSummary, AgentHandoffDetails, handoffExpandable } = await import('./AgentHandoff.js')
const { useAgentHandoff } = await import('../lib/use-agent-handoff.js')

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

// The same composition AgentView uses: the verdict and the next step in the action bar, the
// commits and files behind the bar's disclosure.
function Harness({ open = true }: { open?: boolean }) {
  const state = useAgentHandoff('p1', 'run-1')
  return (
    <>
      <HandoffSummary handoff={state.handoff} />
      {state.error && <span>{state.error}</span>}
      <HandoffActions projectId="p1" agentId="run-1" state={state} />
      {open && handoffExpandable(state.handoff) && <AgentHandoffDetails handoff={state.handoff} />}
    </>
  )
}

beforeEach(() => {
  onAgentHandoff.mockClear()
  sendPushBranch.mockClear()
  sendOpenPullRequest.mockClear()
  sendOpenPullRequest.mockResolvedValue({ ok: true })
  sendSetHandoff.mockClear()
  sendSetHandoff.mockResolvedValue(undefined)
  sendMerge.mockClear()
  sendMerge.mockResolvedValue({ ok: true })
})
afterEach(cleanup)

describe('run handoff (#799)', () => {
  test('summarises what a finished session produced, and lists it when expanded', async () => {
    onAgentHandoff.mockResolvedValue(worked)
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('1 commit')).toBeTruthy())
    expect(screen.getByText('1 file')).toBeTruthy()
    expect(screen.getByText('add dark mode')).toBeTruthy()
    expect(screen.getByText('src/theme.ts')).toBeTruthy()
  })

  test('collapsed, it still says what the branch holds — without the lists (#1023)', async () => {
    onAgentHandoff.mockResolvedValue(worked)
    render(<Harness open={false} />)
    await waitFor(() => expect(screen.getByText('1 commit')).toBeTruthy())
    expect(screen.queryByText('add dark mode')).toBeNull()
    expect(screen.queryByText('src/theme.ts')).toBeNull()
    // The next step is never hidden behind the disclosure.
    expect(screen.getByText('Open PR')).toBeTruthy()
  })

  test('the branch name is not repeated — the action bar it sits in already says it (#1023)', async () => {
    onAgentHandoff.mockResolvedValue(worked)
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('1 commit')).toBeTruthy())
    expect(screen.queryByText('the-framework/dark-mode')).toBeNull()
  })

  test('a session that changed nothing says so, and has nothing to expand', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, commits: [], files: [], insertions: 0, deletions: 0, empty: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('no changes')).toBeTruthy())
    expect(handoffExpandable({ ...worked, empty: true } as never)).toBe(false)
    // Nothing to hand off, so no button — but it says why (#1173). A finished session showing no
    // control and no sentence is exactly the dead end that made "what should I do now?" unanswerable.
    expect(screen.queryByText('Open PR')).toBeNull()
    expect(screen.getByText('Nothing committed — no PR to open.')).toBeTruthy()
  })

  test('a merged branch says merged, not "no changes" — its commits are all on the base', async () => {
    // Merged implies empty: `base..branch` lists nothing once every commit landed. The two facts
    // must not read the same, since one means work shipped and the other means there was none.
    onAgentHandoff.mockResolvedValue({ ...worked, commits: [], files: [], insertions: 0, deletions: 0, empty: true, pushed: true, merged: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('merged')).toBeTruthy())
    expect(screen.queryByText('no changes')).toBeNull()
  })

  test('an empty branch with work waiting in the tree names the work, never a button (#1173)', async () => {
    onAgentHandoff.mockResolvedValue({
      ...worked,
      commits: [],
      files: [],
      insertions: 0,
      deletions: 0,
      empty: true,
      pendingFiles: ['index.html', 'src/app.ts'],
    })
    render(<Harness />)
    // A no-diff branch never gets the Open PR button — GitHub would refuse it with "No commits
    // between main and <branch>", the confusion this ticket started from. What is waiting is said
    // by name instead, and the disclosure lists all of it.
    await waitFor(() => expect(screen.getByText('Nothing committed — index.html, src/app.ts left uncommitted.')).toBeTruthy())
    expect(screen.queryByText('Open PR')).toBeNull()
    expect(screen.getByText('Uncommitted files')).toBeTruthy()
    expect(screen.getByText('index.html')).toBeTruthy()
  })

  test('past two uncommitted files the rest are counted, and the hover carries them all (#1173)', async () => {
    const pendingFiles = ['a.ts', 'b.ts', 'c.ts', 'd.ts']
    onAgentHandoff.mockResolvedValue({ ...worked, commits: [], files: [], insertions: 0, deletions: 0, empty: true, pendingFiles })
    render(<Harness open={false} />)
    const reason = await screen.findByText('Nothing committed — a.ts, b.ts and 2 more left uncommitted.')
    expect(reason.getAttribute('title')).toBe(pendingFiles.join('\n'))
  })

  test('a branch that is gone is reported, not shown as work', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, exists: false, commits: [], files: [], empty: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('branch gone')).toBeTruthy())
    expect(screen.queryByText('Open PR')).toBeNull()
    expect(screen.getByText('Branch gone — nothing to open a PR from.')).toBeTruthy()
  })

  test('push is offered only while the branch is unpushed', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, pushed: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Open PR')).toBeTruthy())
    expect(screen.queryByText('Push branch')).toBeNull()
  })

  test('one button, and it opens the PR — pushing is not a competing choice (#1173)', async () => {
    // "Push branch" and "Open PR" used to sit side by side as equals, and pushing without opening
    // a PR is a step neither of us could put a purpose to. Opening a PR pushes on the way, so the
    // one that names the outcome is the one that is offered.
    onAgentHandoff.mockResolvedValue(worked)
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Open PR')).toBeTruthy())
    expect(screen.queryByText('Push branch')).toBeNull()
    fireEvent.click(screen.getByText('Open PR'))
    await waitFor(() => expect(sendOpenPullRequest).toHaveBeenCalledWith('p1', 'run-1'))
    expect(sendPushBranch).not.toHaveBeenCalled()
  })

  test('a failed action surfaces its reason rather than doing nothing', async () => {
    onAgentHandoff.mockResolvedValue(worked)
    sendOpenPullRequest.mockResolvedValue({ ok: false, error: 'gh: not logged in' })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Open PR')).toBeTruthy())
    fireEvent.click(screen.getByText('Open PR'))
    await waitFor(() => expect(screen.getByText('gh: not logged in')).toBeTruthy())
  })

  test('an existing open PR withdraws the offer and becomes the Merge (#632/#1391)', async () => {
    onAgentHandoff.mockResolvedValue({
      ...worked,
      pushed: true,
      pr: { number: 42, url: 'https://example.test/42', state: 'OPEN', title: 'Add dark mode' },
    })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('1 commit')).toBeTruthy())
    expect(screen.queryByText('Open PR')).toBeNull()
    expect(screen.queryByText('Push branch')).toBeNull()
    // The one step left for an open, unmerged PR is the human's Merge — the withheld-merge
    // ending (#1363) leaves exactly this behind when the agent never signalled.
    fireEvent.click(screen.getByText('Merge PR'))
    await waitFor(() => expect(sendMerge).toHaveBeenCalledWith('p1', 'run-1'))
  })

  test('a merged or closed PR offers nothing — landed is an answer, not an action (#1391)', async () => {
    onAgentHandoff.mockResolvedValue({
      ...worked,
      pushed: true,
      merged: true,
      pr: { number: 42, url: 'https://example.test/42', state: 'MERGED', title: 'Add dark mode' },
    })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('1 commit')).toBeTruthy())
    expect(screen.queryByText('Merge PR')).toBeNull()
    expect(screen.queryByText('Open PR')).toBeNull()
  })

  test('a repo with no remote says why instead of offering a dead button', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, hasRemote: false })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText(/No remote to push to/)).toBeTruthy())
    expect(screen.queryByText('Push branch')).toBeNull()
  })

  test('nothing is rendered before the first read, so no wrong empty state flashes', () => {
    onAgentHandoff.mockReturnValue(new Promise(() => {}) as never)
    const { container } = render(<Harness />)
    expect(container.textContent).toBe('')
  })
})

describe('the handoff checkboxes (#1102)', () => {
  const armed = { push: true, pr: true, merge: false }

  test('one ticked box, so a session left alone hands itself back (#1102/#1173)', () => {
    render(<HandoffArm projectId="p1" agentId="run-1" state={armed} />)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(1)
    expect(screen.getByText('Open PR')).toBeTruthy()
    expect(screen.queryByText('Push branch')).toBeNull()
    expect(boxes[0]?.getAttribute('data-checked')).not.toBeNull()
  })

  test('unticking it means the session hands off nothing at all (#1173)', async () => {
    // One control governs the whole end-of-session step, so what the box says is what happens.
    // It used to leave the push armed, which is a thing still happening that nothing on screen said.
    render(<HandoffArm projectId="p1" agentId="run-1" state={armed} />)
    fireEvent.click(screen.getByText('Open PR'))
    await waitFor(() => expect(sendSetHandoff).toHaveBeenCalledWith('p1', 'run-1', 'local'))
  })

  test('ticking it arms the push too, since opening a PR needs the branch on the remote', async () => {
    // One rung travels (B5), and it already includes the push: nothing on the receiving end has to
    // remember that a PR implies one.
    render(<HandoffArm projectId="p1" agentId="run-1" state={{ push: false, pr: false, merge: false }} />)
    fireEvent.click(screen.getByText('Open PR'))
    await waitFor(() => expect(sendSetHandoff).toHaveBeenCalledWith('p1', 'run-1', 'pr'))
  })

  test('a push-only session says "Push branch", rather than an unticked box while it pushes (#1173)', () => {
    // Reachable from the settings, where push and PR are still separate. The one box names whatever
    // this session will actually do, so it is never describing something other than what happens.
    render(<HandoffArm projectId="p1" agentId="run-1" state={{ push: true, pr: false, merge: false }} />)
    expect(screen.getByText('Push branch')).toBeTruthy()
    expect(screen.getAllByRole('checkbox')[0]?.getAttribute('data-checked')).not.toBeNull()
  })

  test('a merge-armed session says "Open PR & merge" — never "Open PR" about a run that lands on main (#1382)', () => {
    render(<HandoffArm projectId="p1" agentId="run-1" state={{ push: true, pr: true, merge: true }} />)
    expect(screen.getByText('Open PR & merge')).toBeTruthy()
    expect(screen.queryByText('Open PR')).toBeNull()
  })

  test('the click holds until the run echoes it back, so the box does not bounce', async () => {
    // The instruction round-trips through a file the agent tails, so the events lag the click by a
    // beat. Rendering the stale value in that window would flick the box back on under the cursor.
    const { rerender } = render(<HandoffArm projectId="p1" agentId="run-1" state={armed} />)
    fireEvent.click(screen.getByText('Open PR'))
    await waitFor(() => expect(sendSetHandoff).toHaveBeenCalled())
    rerender(<HandoffArm projectId="p1" agentId="run-1" state={armed} />)
    expect(screen.getAllByRole('checkbox')[0]?.getAttribute('data-checked')).toBeNull()
  })
})
