import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const onAgentHandoff = vi.fn(async () => null as unknown)
const sendOpenPullRequest = vi.fn(async () => ({ ok: true }) as unknown)
const sendMerge = vi.fn(async () => ({ ok: true }) as unknown)
const sendPush = vi.fn(async () => ({ ok: true }) as unknown)
vi.mock('../rpc/reads.js', () => ({ onAgentHandoff }))
vi.mock('../rpc/control.js', () => ({ sendOpenPullRequest, sendMerge, sendPush }))

const { HandoffActions, HandoffSummary, AgentHandoffDetails, handoffExpandable } = await import('./AgentHandoff.js')
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
  gitHost: true,
}

// The same composition AgentView uses: the verdict and the next step in the action bar, the
// commits and files behind the bar's disclosure.
function Harness({ open = true, subagent = false }: { open?: boolean; subagent?: boolean }) {
  const state = useAgentHandoff('p1', 'run-1')
  return (
    <>
      <HandoffSummary handoff={state.handoff} subagent={subagent} />
      {state.error && <span>{state.error}</span>}
      <HandoffActions projectId="p1" agentId="run-1" state={state} subagent={subagent} />
      {open && handoffExpandable(state.handoff) && <AgentHandoffDetails handoff={state.handoff} />}
    </>
  )
}

beforeEach(() => {
  onAgentHandoff.mockClear()
  sendOpenPullRequest.mockClear()
  sendOpenPullRequest.mockResolvedValue({ ok: true })
  sendMerge.mockClear()
  sendMerge.mockResolvedValue({ ok: true })
  sendPush.mockClear()
  sendPush.mockResolvedValue({ ok: true })
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
    expect(screen.getByText('Publish & Open PR')).toBeTruthy()
  })

  test('the branch name is not repeated — the action bar it sits in already says it (#1023)', async () => {
    onAgentHandoff.mockResolvedValue(worked)
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('1 commit')).toBeTruthy())
    expect(screen.queryByText('the-framework/dark-mode')).toBeNull()
  })

  test('a session that changed nothing reads no changes, says nothing more, and has nothing to expand', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, commits: [], files: [], insertions: 0, deletions: 0, empty: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('no changes')).toBeTruthy())
    expect(handoffExpandable({ ...worked, empty: true } as never)).toBe(false)
    // Nothing to hand off and nothing to do: no button and no sentence, since a run with work always
    // shows its button.
    expect(screen.queryByText('Publish & Open PR')).toBeNull()
    expect(screen.queryByText(/nothing to open|no PR to open/i)).toBeNull()
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
    expect(screen.queryByText('Publish & Open PR')).toBeNull()
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
    expect(screen.queryByText('Publish & Open PR')).toBeNull()
    expect(screen.getByText('Branch gone — nothing to open a PR from.')).toBeTruthy()
  })

  test('a branch gone because the run changed nothing reads as no changes, not as lost work', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, exists: false, unchanged: true, commits: [], files: [], empty: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('no changes')).toBeTruthy())
    expect(screen.queryByText(/nothing to open|no PR to open/i)).toBeNull()
    expect(screen.queryByText(/Branch gone/i)).toBeNull()
  })

  test('push is offered only while the branch is unpushed', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, pushed: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Publish & Open PR')).toBeTruthy())
    expect(screen.queryByText('Push branch')).toBeNull()
  })

  test('one button, and it opens the PR — pushing is not a competing choice (#1173)', async () => {
    // "Push branch" and "Open PR" used to sit side by side as equals, and pushing without opening
    // a PR is a step neither of us could put a purpose to. Opening a PR pushes on the way, so the
    // one that names the outcome is the one that is offered.
    onAgentHandoff.mockResolvedValue(worked)
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Publish & Open PR')).toBeTruthy())
    expect(screen.queryByText('Push branch')).toBeNull()
    fireEvent.click(screen.getByText('Publish & Open PR'))
    await waitFor(() => expect(sendOpenPullRequest).toHaveBeenCalledWith('p1', 'run-1'))
  })

  test('a failed action surfaces its reason rather than doing nothing', async () => {
    onAgentHandoff.mockResolvedValue(worked)
    sendOpenPullRequest.mockResolvedValue({ ok: false, error: 'gh: not logged in' })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Publish & Open PR')).toBeTruthy())
    fireEvent.click(screen.getByText('Publish & Open PR'))
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
    expect(screen.queryByText('Publish & Open PR')).toBeNull()
    expect(screen.queryByText('Push branch')).toBeNull()
    // The bar links the pull request: pushed is not said beside it.
    expect(screen.queryByText('· pushed')).toBeNull()
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
    expect(screen.queryByText('Publish & Open PR')).toBeNull()
  })

  test('with no git host package the last step is Push, and a pushed branch is where the handoff ends (#1820)', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, gitHost: false })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Push')).toBeTruthy())
    expect(screen.queryByText('Publish & Open PR')).toBeNull()
    fireEvent.click(screen.getByText('Push'))
    await waitFor(() => expect(sendPush).toHaveBeenCalledWith('p1', 'run-1'))
    cleanup()
    onAgentHandoff.mockResolvedValue({ ...worked, gitHost: false, pushed: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText(/Pushed — no git host package/)).toBeTruthy())
    expect(screen.queryByText('Push')).toBeNull()
  })

  test('a repo with no remote says why instead of offering a dead button', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, hasRemote: false })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText(/No remote to push to/)).toBeTruthy())
    expect(screen.queryByText('Push branch')).toBeNull()
  })

  test('work still only on this machine says not published; once pushed with no pull request it says pushed; with no remote it says neither', async () => {
    onAgentHandoff.mockResolvedValue(worked)
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('· not published')).toBeTruthy())
    cleanup()

    onAgentHandoff.mockResolvedValue({ ...worked, pushed: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('· pushed')).toBeTruthy())
    expect(screen.queryByText('· not published')).toBeNull()
    cleanup()

    onAgentHandoff.mockResolvedValue({ ...worked, hasRemote: false })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('1 commit')).toBeTruthy())
    expect(screen.queryByText(/published|· pushed/)).toBeNull()
  })

  test('a subagent is offered no pull request, no push and no merge: its line says whether its main agent landed it', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, pushed: true })
    render(<Harness subagent />)
    await waitFor(() => expect(screen.getByText('not landed')).toBeTruthy())
    expect(screen.getByText('1 commit')).toBeTruthy()
    expect(screen.queryByText('· pushed')).toBeNull()
    expect(screen.queryByText('· not published')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()

    // Not even where another run would be offered the Merge of its open pull request, or a Push.
    onAgentHandoff.mockResolvedValue({ ...worked, pr: { number: 7, url: 'u', state: 'OPEN', title: '' } })
    render(<Harness subagent />)
    await waitFor(() => expect(screen.getByText('not landed')).toBeTruthy())
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()
    onAgentHandoff.mockResolvedValue({ ...worked, gitHost: false })
    render(<Harness subagent />)
    await waitFor(() => expect(screen.getByText('not landed')).toBeTruthy())
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('a landed subagent still says what it changed, and that it is landed', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, branch: 'a'.repeat(40), landed: true })
    render(<Harness subagent />)
    await waitFor(() => expect(screen.getByText('landed')).toBeTruthy())
    expect(screen.getByText('1 commit')).toBeTruthy()
    expect(screen.getByText('src/theme.ts')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()

    // Its last commit is not on this machine: landed is still the answer, never "branch gone".
    onAgentHandoff.mockResolvedValue({ ...worked, exists: false, commits: [], files: [], empty: true, landed: true })
    render(<Harness subagent />)
    await waitFor(() => expect(screen.getByText('landed')).toBeTruthy())
    expect(screen.queryByText('branch gone')).toBeNull()
    expect(screen.queryByText('no changes')).toBeNull()
    expect(screen.queryByText(/nothing to open a PR from/)).toBeNull()
  })

  test('a subagent that ended without committing has its uncommitted work named, and its gone branch draws no reason', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, commits: [], files: [], empty: true, pendingFiles: ['handtest/one.md'] })
    render(<Harness subagent />)
    await waitFor(() => expect(screen.getByText('Nothing committed — handtest/one.md left uncommitted.')).toBeTruthy())
    expect(screen.getByText('no changes')).toBeTruthy()
    expect(screen.queryByText('not landed')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()

    onAgentHandoff.mockResolvedValue({ ...worked, exists: false, commits: [], files: [], empty: true })
    render(<Harness subagent />)
    await waitFor(() => expect(screen.getByText('branch gone')).toBeTruthy())
    expect(screen.queryByText(/nothing to open a PR from/)).toBeNull()
  })

  test('nothing is rendered before the first read, so no wrong empty state flashes', () => {
    onAgentHandoff.mockReturnValue(new Promise(() => {}) as never)
    const { container } = render(<Harness />)
    expect(container.textContent).toBe('')
  })
})
