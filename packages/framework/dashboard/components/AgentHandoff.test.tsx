import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const onAgentHandoff = vi.fn(async () => null as unknown)
const sendOpenPullRequest = vi.fn(async () => ({ ok: true }) as unknown)
const sendMerge = vi.fn(async () => ({ ok: true }) as unknown)
const sendPush = vi.fn(async () => ({ ok: true }) as unknown)
const sendMergeBranch = vi.fn(async () => ({ ok: true }) as unknown)
const sendMessage = vi.fn(async () => ({ ok: true }) as unknown)
vi.mock('../rpc/reads.js', () => ({ onAgentHandoff }))
vi.mock('../rpc/control.js', () => ({ sendOpenPullRequest, sendMerge, sendPush, sendMergeBranch, sendMessage }))

const { HandoffActions, HandoffSummary, AgentHandoffDetails, handoffExpandable, handoffSays } = await import('./AgentHandoff.js')
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
  sendMergeBranch.mockClear()
  sendMessage.mockClear()
  sendMessage.mockResolvedValue({ ok: true })
  sendMergeBranch.mockResolvedValue({ ok: true })
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

  test('a session that changed nothing reads no changes, says nothing more, and has nothing to expand', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, commits: [], files: [], insertions: 0, deletions: 0, empty: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('no changes')).toBeTruthy())
    expect(handoffExpandable({ ...worked, commits: [], files: [], empty: true } as never)).toBe(false)
    // Nothing to hand off and nothing to do: no button and no sentence, since a run with work always
    // shows its button.
    expect(screen.queryByText('Open PR')).toBeNull()
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
    expect(screen.queryByText('Open PR')).toBeNull()
    expect(screen.getByText('Uncommitted files')).toBeTruthy()
    expect(screen.getByText('index.html')).toBeTruthy()
  })

  test('uncommitted work gets a Commit button that asks the agent to commit; a subagent, and a branch with nothing left behind, get none', async () => {
    const left = { ...worked, commits: [], files: [], insertions: 0, deletions: 0, empty: true, pendingFiles: ['index.html'] }
    onAgentHandoff.mockResolvedValue(left)
    render(<Harness open={false} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Commit' }))
    // The agent is asked: it writes the commit, the dashboard commits nothing itself.
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('p1', 'Commit your work.', 'run-1'))
    cleanup()

    sendMessage.mockClear()
    sendMessage.mockResolvedValue({ ok: false, error: 'this project has no resume hook' })
    render(<Harness open={false} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Commit' }))
    await waitFor(() => expect(screen.getByText(/this project has no resume hook/)).toBeTruthy())
    cleanup()

    onAgentHandoff.mockResolvedValue({ ...left, pendingFiles: [] })
    render(<Harness open={false} />)
    await waitFor(() => expect(onAgentHandoff).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Commit' })).toBeNull()
    cleanup()

    onAgentHandoff.mockResolvedValue(left)
    render(<Harness open={false} subagent />)
    await waitFor(() => expect(screen.getByText('Nothing committed — index.html left uncommitted.')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Commit' })).toBeNull()
  })

  test('uncommitted work on top of commits gets Commit first: no merge, no publish, until the checkout is clean', async () => {
    // The agent committed, was asked for more, and left that uncommitted.
    onAgentHandoff.mockResolvedValue({ ...worked, hasRemote: false, base: 'main', pendingFiles: ['index.html'] })
    render(<Harness open={false} />)
    await waitFor(() => expect(screen.getByText('index.html left uncommitted.')).toBeTruthy())
    expect(screen.queryByText(/Nothing committed/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Merge' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }))
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('p1', 'Commit your work.', 'run-1'))
    cleanup()

    // With a remote and a git host too: Commit, not Open PR.
    onAgentHandoff.mockResolvedValue({ ...worked, pendingFiles: ['index.html'] })
    render(<Harness open={false} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Commit' })).toBeTruthy())
    expect(screen.queryByText('Open PR')).toBeNull()
    cleanup()

    // Clean again: the next step is back.
    onAgentHandoff.mockResolvedValue({ ...worked, hasRemote: false, base: 'main' })
    render(<Harness open={false} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Merge' })).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Commit' })).toBeNull()
  })

  test('commits that cancel out are still counted and listed, and the bar says there is nothing to take', async () => {
    const cancelled = { ...worked, hasRemote: false, base: 'main', commits: [{ sha: 'a'.repeat(40), short: 'aaaaaaa', subject: 'Change to welcome' }, { sha: 'b'.repeat(40), short: 'bbbbbbb', subject: 'Change back to hello' }], files: [], insertions: 0, deletions: 0, empty: true }
    onAgentHandoff.mockResolvedValue(cancelled)
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('2 commits · no change left')).toBeTruthy())
    expect(screen.getByText('Nothing to merge: the commits cancel out.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Merge' })).toBeNull()
    // The disclosure still lists what the agent did.
    expect(screen.getByText('Change to welcome')).toBeTruthy()
    expect(screen.getByText('Change back to hello')).toBeTruthy()
    cleanup()

    onAgentHandoff.mockResolvedValue({ ...cancelled, hasRemote: true })
    render(<Harness open={false} />)
    await waitFor(() => expect(screen.getByText('Nothing to publish: the commits cancel out.')).toBeTruthy())
    cleanup()

    // No commits at all is still "no changes", with nothing said where the button would be.
    onAgentHandoff.mockResolvedValue({ ...cancelled, commits: [] })
    render(<Harness open={false} />)
    await waitFor(() => expect(screen.getByText('no changes')).toBeTruthy())
    expect(screen.queryByText(/cancel out/)).toBeNull()
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

  test('a branch gone because the run changed nothing reads as no changes, not as lost work', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, exists: false, unchanged: true, commits: [], files: [], empty: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('no changes')).toBeTruthy())
    expect(screen.queryByText(/nothing to open|no PR to open/i)).toBeNull()
    expect(screen.queryByText(/Branch gone/i)).toBeNull()
  })

  test('a split button: Open PR pushes and opens the pull request, and its menu holds the push alone', async () => {
    onAgentHandoff.mockResolvedValue(worked)
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Open PR')).toBeTruthy())
    // The push alone is in the menu, never a second button beside the first (#1173).
    expect(screen.queryByText('Publish branch')).toBeNull()
    fireEvent.click(screen.getByText('Open PR'))
    await waitFor(() => expect(sendOpenPullRequest).toHaveBeenCalledWith('p1', 'run-1', { draft: false }))
    expect(sendPush).not.toHaveBeenCalled()
  })

  test('Create draft PR, under the arrow, opens the pull request as a draft, pushed or not', async () => {
    onAgentHandoff.mockResolvedValue(worked)
    const { unmount } = render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Other choices' }))
    fireEvent.click(await screen.findByText('Create draft PR'))
    await waitFor(() => expect(sendOpenPullRequest).toHaveBeenCalledWith('p1', 'run-1', { draft: true }))
    expect(sendPush).not.toHaveBeenCalled()
    unmount()
    onAgentHandoff.mockResolvedValue({ ...worked, pushed: true })
    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Other choices' }))
    expect(await screen.findByText('Create draft PR')).toBeTruthy()
    // The branch is on the remote already: the push alone is no choice any more.
    expect(screen.queryByText('Publish branch')).toBeNull()
  })

  test('Publish branch, in the menu, pushes the branch and opens no pull request', async () => {
    onAgentHandoff.mockResolvedValue(worked)
    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Other choices' }))
    fireEvent.click(await screen.findByText('Publish branch'))
    await waitFor(() => expect(sendPush).toHaveBeenCalledWith('p1', 'run-1'))
    expect(sendOpenPullRequest).not.toHaveBeenCalled()
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
    expect(screen.queryByRole('button', { name: 'Other choices' })).toBeNull()
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
    expect(screen.queryByText('Open PR')).toBeNull()
  })

  test('with no git host package the last step is Publish branch, one plain button, and a pushed branch is where the handoff ends (#1820)', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, gitHost: false })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Publish branch')).toBeTruthy())
    expect(screen.queryByText('Open PR')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Other choices' })).toBeNull()
    fireEvent.click(screen.getByText('Publish branch'))
    await waitFor(() => expect(sendPush).toHaveBeenCalledWith('p1', 'run-1'))
    cleanup()
    onAgentHandoff.mockResolvedValue({ ...worked, gitHost: false, pushed: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText(/Pushed — no git host package/)).toBeTruthy())
    expect(screen.queryByText('Publish branch')).toBeNull()
  })

  test('a repo with no remote offers the one step it has: merge the work into the main branch, on this machine', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, hasRemote: false, base: 'main' })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Not in main yet.')).toBeTruthy())
    expect(screen.queryByText(/Open PR|Publish branch/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }))
    await waitFor(() => expect(sendMergeBranch).toHaveBeenCalledWith('p1', 'run-1'))
    expect(sendPush).not.toHaveBeenCalled()
  })

  test('a merge that does not go in shows the reason; merged work says so and offers nothing more', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, hasRemote: false, base: 'main' })
    sendMergeBranch.mockResolvedValue({ ok: false, error: 'agent-x does not merge cleanly into main: it conflicts in a.ts; nothing was changed' })
    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Merge' }))
    await waitFor(() => expect(screen.getByText(/does not merge cleanly into main/)).toBeTruthy())
    cleanup()

    // Its branch went with the merge: the record says landed.
    onAgentHandoff.mockResolvedValue({ ...worked, hasRemote: false, landed: true, merged: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Merged into the main branch.')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Merge/ })).toBeNull()
    cleanup()

    // A branch that was kept and is in the main branch already.
    onAgentHandoff.mockResolvedValue({ ...worked, hasRemote: false, base: 'main', merged: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Merged into main.')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Merge/ })).toBeNull()
    cleanup()

    // With a remote too: work the main branch already has keeps its count and is offered no publish step.
    onAgentHandoff.mockResolvedValue({ ...worked, base: 'a'.repeat(40), merged: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Merged into the main branch.')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Open PR|Publish branch|Merge/ })).toBeNull()
    expect(screen.queryByText('not published')).toBeNull()
  })

  test('work still only on this machine says not published beside its button; once pushed it says pushed; with no remote it says neither', async () => {
    onAgentHandoff.mockResolvedValue(worked)
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('not published')).toBeTruthy())
    expect(screen.getByText('Open PR')).toBeTruthy()
    cleanup()

    // No git host package: the same word beside Publish branch.
    onAgentHandoff.mockResolvedValue({ ...worked, gitHost: false })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Publish branch')).toBeTruthy())
    expect(screen.getByText('not published')).toBeTruthy()
    cleanup()

    onAgentHandoff.mockResolvedValue({ ...worked, pushed: true })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('· pushed')).toBeTruthy())
    expect(screen.queryByText('not published')).toBeNull()
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
    expect(screen.queryByText('not published')).toBeNull()
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

  test('the bar has something to say for work, landed work and a lost branch, and nothing for an agent that changed nothing', () => {
    expect(handoffSays(null)).toBe(false)
    expect(handoffSays(worked as never)).toBe(true)
    // Nothing committed, nothing left on disk: nothing to say, merged into the base or not.
    expect(handoffSays({ ...worked, commits: [], files: [], empty: true, merged: true } as never)).toBe(false)
    expect(handoffSays({ ...worked, commits: [], files: [], empty: true, pendingFiles: ['index.html'] } as never)).toBe(true)
    // Commits that cancel out are still what the agent did.
    expect(handoffSays({ ...worked, files: [], empty: true } as never)).toBe(true)
    expect(handoffSays({ ...worked, exists: false, unchanged: true } as never)).toBe(false)
    expect(handoffSays({ ...worked, exists: false } as never)).toBe(true)
    expect(handoffSays({ ...worked, exists: false, landed: true } as never)).toBe(true)
  })

  test('nothing is rendered before the first read, so no wrong empty state flashes', () => {
    onAgentHandoff.mockReturnValue(new Promise(() => {}) as never)
    const { container } = render(<Harness />)
    expect(container.textContent).toBe('')
  })
  test('Merge pressed: the button says "Merging…" until the branch is read again, never "Merge" in between', async () => {
    onAgentHandoff.mockResolvedValue({ ...worked, hasRemote: false, gitHost: false })
    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Merge' }))
    // The merge is done; the read made after it has not answered yet.
    let answer: (handoff: unknown) => void = () => {}
    onAgentHandoff.mockReturnValue(new Promise(resolve => (answer = resolve)) as never)
    await waitFor(() => expect(sendMergeBranch).toHaveBeenCalled())
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(screen.getByRole('button', { name: 'Merging…' })).toBeTruthy()
    answer({ ...worked, hasRemote: false, gitHost: false, landed: true })
    await waitFor(() => expect(screen.getByText('Merged into the main branch.')).toBeTruthy())
    expect(screen.queryByRole('button')).toBeNull()
  })
})
