import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readAgentHandoff, resolveAgentPr, mergeAgentPr, agentBranchFor, openAgentPullRequest, openRemoteBranchPullRequest, pushAgentBranch, type HandoffAgent } from './agent-handoff.js'
import { pickAgentPr, type LinkedPr } from './gh.js'
import type { BranchState, BranchesFor, BranchesSource } from '../store/branches.js'
import type { ForgeFor, ForgeSource } from '../store/forge.js'
import type { AgentMeta } from '../store/index.js'

// The handoff over the two providers (#1774, #1820): the branch's facts come from the branches
// provider's `show` and its push from `push`; every pull request goes through the forge provider's
// `open` and `merge`; and what is tested here is what the framework decides on top: which PR is
// the run's, when an existing PR is the answer, what the PR says, and what each button refuses.

/** A branch with work on it, as the provider answers `show`. */
const state = (over: Partial<BranchState> = {}): BranchState => ({
  branch: 'the-framework/work',
  exists: true,
  base: 'origin/main',
  commits: [
    { sha: 'abc1234567', subject: 'second: with spaces' },
    { sha: 'def4567890', subject: 'first' },
  ],
  files: [
    { path: 'src/app.ts', insertions: 3, deletions: 1, binary: false },
    { path: 'logo.png', insertions: 0, deletions: 0, binary: true },
  ],
  hasRemote: true,
  pushed: false,
  merged: false,
  ...over,
})

/** The two fake providers over one call log: the branches provider's `show` answers from `states` (a branch missing there is not answered) and its `push` as told; the forge's `open` and `merge` answer as told. */
function fakeBranches(
  states: Record<string, BranchState | undefined>,
  answers: { push?: Awaited<ReturnType<BranchesSource['push']>>; open?: Awaited<ReturnType<ForgeSource['open']>>; merge?: Awaited<ReturnType<ForgeSource['merge']>> } = {},
): { branches: BranchesFor; forge: ForgeFor; calls: unknown[][] } {
  const calls: unknown[][] = []
  const branches: BranchesFor = async () => ({
    list: async () => [],
    show: async asked => {
      calls.push(['show', ...asked])
      return asked.flatMap(branch => {
        const answer = states[branch]
        return answer ? [answer] : []
      })
    },
    push: async branch => {
      calls.push(['push', branch])
      return answers.push ?? { ok: true, pushed: true }
    },
    remove: async () => ({ ok: true }),
  })
  const forge: ForgeFor = async () => ({
    requests: async () => ({ ok: true, requests: [] }),
    open: async (branch, opts) => {
      calls.push(['open', branch, opts])
      return answers.open ?? { ok: true, request: { number: 9, url: 'https://github.com/o/r/pull/9' }, existing: false }
    },
    merge: async number => {
      calls.push(['merge', number])
      return answers.merge ?? { ok: true, outcome: 'auto-armed' }
    },
    home: async () => undefined,
  })
  return { branches, forge, calls }
}

const noPr = async (): Promise<LinkedPr | undefined> => undefined
const noBranches: BranchesFor = async () => undefined
const noForge: ForgeFor = async () => undefined

test('the branch an agent\'s work is on is the one its record carries, and nothing else (#799/#1725)', () => {
  assert.equal(agentBranchFor({ id: 'r1', branch: 'feat/mine' }), 'feat/mine')
  assert.equal(agentBranchFor({ id: 'r1', branch: 'agent-named' }), 'agent-named')
  assert.equal(agentBranchFor({ id: 'r1' }), undefined)
})

test('a project with no branches provider, or a branch the provider does not answer for, yields no handoff at all', async () => {
  assert.equal(await readAgentHandoff('/repo', 'b', { branches: noBranches, pr: noPr }), undefined)
  const { branches } = fakeBranches({})
  assert.equal(await readAgentHandoff('/repo', 'b', { branches, pr: noPr }), undefined)
})

test('a branch that no longer exists reports exists:false rather than failing, and still says whether there is a remote', async () => {
  const { base: _base, ...gone } = state({ branch: 'gone', exists: false, commits: [], files: [] })
  const { branches } = fakeBranches({ gone })
  const handoff = await readAgentHandoff('/repo', 'gone', { branches, pr: noPr })
  assert.equal(handoff?.exists, false)
  assert.equal(handoff?.empty, true)
  assert.equal(handoff?.hasRemote, true)
  assert.equal(handoff?.base, undefined)
})

test('a session that changed nothing is reported empty, not as an empty branch', async () => {
  const { branches } = fakeBranches({ q: state({ branch: 'q', commits: [], files: [] }) })
  const handoff = await readAgentHandoff('/repo', 'q', { branches, pr: noPr })
  assert.equal(handoff?.exists, true)
  assert.equal(handoff?.empty, true)
  assert.deepEqual(handoff?.commits, [])
  assert.equal(handoff?.insertions, 0)
  assert.equal(handoff?.deletions, 0)
  // Commits that net to no change leave nothing to hand off either.
  const { branches: netted } = fakeBranches({ q: state({ branch: 'q', files: [] }) })
  assert.equal((await readAgentHandoff('/repo', 'q', { branches: netted, pr: noPr }))?.empty, true)
})

test('commits, files and line counts come back for a branch with work, as the provider answered them (#799)', async () => {
  const { branches, calls } = fakeBranches({ 'the-framework/work': state() })
  const handoff = await readAgentHandoff('/repo', 'the-framework/work', { branches, pr: noPr })
  assert.deepEqual(calls, [['show', 'the-framework/work']])
  assert.equal(handoff?.exists, true)
  assert.equal(handoff?.empty, false)
  assert.equal(handoff?.base, 'origin/main')
  assert.deepEqual(handoff?.commits, [
    { sha: 'abc1234567', short: 'abc1234', subject: 'second: with spaces' },
    { sha: 'def4567890', short: 'def4567', subject: 'first' },
  ])
  assert.deepEqual(handoff?.files, [
    { path: 'src/app.ts', insertions: 3, deletions: 1, binary: false },
    { path: 'logo.png', insertions: 0, deletions: 0, binary: true },
  ])
  assert.equal(handoff?.insertions, 3)
  assert.equal(handoff?.deletions, 1)
  assert.equal(handoff?.hasRemote, true)
  assert.equal(handoff?.pushed, false)
  assert.equal(handoff?.merged, false)
  assert.equal(handoff?.pendingFiles, undefined, 'no checkout on the branch: nobody asked about uncommitted work')
})

test('pushed, merged, no remote, and uncommitted work in the checkout are carried through (#1173)', async () => {
  const { branches } = fakeBranches({
    pushed: state({ branch: 'pushed', pushed: true }),
    merged: state({ branch: 'merged', merged: true }),
    local: state({ branch: 'local', hasRemote: false }),
    dirty: state({ branch: 'dirty', commits: [], files: [], pendingFiles: ['src/app.ts', 'src/new.ts'] }),
  })
  assert.equal((await readAgentHandoff('/repo', 'pushed', { branches, pr: noPr }))?.pushed, true)
  assert.equal((await readAgentHandoff('/repo', 'merged', { branches, pr: noPr }))?.merged, true)
  assert.equal((await readAgentHandoff('/repo', 'local', { branches, pr: noPr }))?.hasRemote, false)
  // The branch really is empty; the work is real and sitting next to it. Both are true at once,
  // which is the whole of #1173 — and the paths are what the bar names instead of a dead button.
  const dirty = await readAgentHandoff('/repo', 'dirty', { branches, pr: noPr })
  assert.equal(dirty?.empty, true)
  assert.deepEqual(dirty?.pendingFiles, ['src/app.ts', 'src/new.ts'])
})

test('the PR is looked up for the session branch (#799), and a gone branch still reports its PR: it is a remote question (#1255)', async () => {
  const { branches } = fakeBranches({ 'the-framework/x': state({ branch: 'the-framework/x' }), gone: state({ branch: 'gone', exists: false, commits: [], files: [] }) })
  const asked: string[] = []
  const handoff = await readAgentHandoff('/repo', 'the-framework/x', {
    branches,
    pr: async (_cwd, branch) => {
      asked.push(branch)
      return { number: 7, url: 'https://example.test/7', state: 'OPEN', title: 'the pr' }
    },
  })
  assert.deepEqual(asked, ['the-framework/x'])
  assert.equal(handoff?.pr?.number, 7)
  const goneHandoff = await readAgentHandoff('/repo', 'gone', {
    branches,
    pr: async () => ({ number: 1254, url: 'u1254', state: 'MERGED', title: 'web run', createdAt: '2026-07-26T21:52:58Z' }),
  })
  assert.equal(goneHandoff?.exists, false)
  assert.equal(goneHandoff?.pr?.number, 1254)
})

const agent = (over: Partial<AgentMeta> = {}): AgentMeta => ({ id: 'r1', status: 'done', startedAt: '2026-07-26T00:00:00Z', updatedAt: '2026-07-26T01:00:00Z', branch: 'the-framework/work', intent: 'fix it', ...over })
const { branch: _branch, ...unbranched } = agent()

test('the Open PR button pushes the branch through the branches provider, then opens its pull request through the forge, with the title and body the run gives it', async () => {
  const { branches, forge, calls } = fakeBranches({ 'the-framework/work': state() })
  const result = await openAgentPullRequest('/repo', agent(), { branches, forge })
  assert.deepEqual(result, { ok: true, url: 'https://github.com/o/r/pull/9', number: 9 })
  assert.deepEqual(calls.slice(-2), [
    ['push', 'the-framework/work'],
    ['open', 'the-framework/work', { title: 'the-framework/work', body: 'fix it\n\nOpened from The Framework session `r1`.' }],
  ])
  // A caller not asking for review opens a draft.
  await openAgentPullRequest('/repo', agent(), { branches, forge, draft: true })
  assert.deepEqual((calls.at(-1) as unknown[])[2], { title: 'the-framework/work', body: 'fix it\n\nOpened from The Framework session `r1`.', draft: true })
})

test('the Open PR button refuses a session with no branch, a gone branch, an empty branch, a project with no branches provider, and one with no forge', async () => {
  const { branches, forge } = fakeBranches({ gone: state({ branch: 'gone', exists: false, commits: [], files: [] }), empty: state({ branch: 'empty', commits: [], files: [] }), 'the-framework/work': state() })
  assert.deepEqual(await openAgentPullRequest('/repo', unbranched, { branches, forge }), { ok: false, error: 'this session recorded no branch to open a PR from' })
  assert.deepEqual(await openAgentPullRequest('/repo', agent({ branch: 'gone' }), { branches, forge }), { ok: false, error: 'branch gone no longer exists' })
  assert.deepEqual(await openAgentPullRequest('/repo', agent({ branch: 'empty' }), { branches, forge }), { ok: false, error: 'this session produced no commits to open a PR for' })
  assert.deepEqual(await openAgentPullRequest('/repo', agent(), { branches: noBranches, forge }), { ok: false, error: 'this project has no branches provider to push with' })
  assert.deepEqual(await openAgentPullRequest('/repo', agent(), { branches, forge: noForge }), { ok: false, error: 'this project has no forge package to open a pull request with' })
})

test("a provider's refusal is the button's answer, never a throw: a dirty checkout stops before the forge is asked, a refused open is the forge's line", async () => {
  const dirty = fakeBranches({ 'the-framework/work': state() }, { push: { ok: false, error: 'the-framework/work has uncommitted work; commit or delete it, then push' } })
  assert.deepEqual(await openAgentPullRequest('/repo', agent(), { branches: dirty.branches, forge: dirty.forge }), { ok: false, error: 'the-framework/work has uncommitted work; commit or delete it, then push' })
  assert.deepEqual(await openRemoteBranchPullRequest('/repo', agent(), 'claude/x', { branches: dirty.branches, forge: dirty.forge }), { ok: false, error: 'the-framework/work has uncommitted work; commit or delete it, then push' })
  assert.deepEqual(dirty.calls.filter(call => call[0] === 'open'), [], 'nothing asked of the forge')
  const refused = fakeBranches({ 'the-framework/work': state() }, { open: { ok: false, error: 'gh: not logged in' } })
  assert.deepEqual(await openAgentPullRequest('/repo', agent(), { branches: refused.branches, forge: refused.forge }), { ok: false, error: 'gh: not logged in' })
})

test('a remote-only branch gets its draft PR through the two providers, and the body says what the agent said or what was asked (#1601/#1567)', async () => {
  const { branches, forge, calls } = fakeBranches({})
  const result = await openRemoteBranchPullRequest('/repo', { id: 'r1', branch: 'agent-x', intent: 'fix it', description: 'What changed: the cart keeps its items.' }, 'claude/x', { branches, forge })
  assert.deepEqual(result, { ok: true, url: 'https://github.com/o/r/pull/9', number: 9 })
  assert.deepEqual(calls, [['push', 'claude/x'], ['open', 'claude/x', { title: 'agent-x', body: 'What changed: the cart keeps its items.\n\nOpened from The Framework session `r1`.', draft: true }]])
  await openRemoteBranchPullRequest('/repo', { id: 'r1', branch: 'agent-x', intent: 'fix it' }, 'claude/x', { branches, forge })
  assert.equal((calls.at(-1)![2] as { body: string }).body, 'fix it\n\nOpened from The Framework session `r1`.')
})

test('the Push button pushes a finished session\'s branch through the branches provider: the last step where the project has no forge (#1820)', async () => {
  const { branches, forge, calls } = fakeBranches({ 'the-framework/work': state() })
  assert.deepEqual(await pushAgentBranch('/repo', agent(), { branches }), { ok: true })
  assert.deepEqual(calls, [['push', 'the-framework/work']])
  assert.deepEqual(await pushAgentBranch('/repo', unbranched, { branches }), { ok: false, error: 'this session recorded no branch to push' })
  assert.deepEqual(await pushAgentBranch('/repo', agent(), { branches: noBranches }), { ok: false, error: 'this project has no branches provider to push with' })
  const handoff = await readAgentHandoff('/repo', 'the-framework/work', { branches, forge: noForge, pr: noPr })
  assert.equal(handoff?.forge, false, 'the handoff says the project has no forge, so the bar offers Push')
  assert.equal((await readAgentHandoff('/repo', 'the-framework/work', { branches, forge, pr: noPr }))?.forge, true)
})

test('pickAgentPr trusts an open PR, and otherwise only one created after the run started (#1251)', () => {
  const older = { number: 1, url: 'u1', state: 'MERGED', title: 'old', createdAt: '2026-07-01T00:00:00Z' }
  const newer = { number: 2, url: 'u2', state: 'MERGED', title: 'new', createdAt: '2026-07-03T00:00:00Z' }
  const newest = { number: 3, url: 'u3', state: 'CLOSED', title: 'newest', createdAt: '2026-07-04T00:00:00Z' }
  const open = { number: 4, url: 'u4', state: 'OPEN', title: 'open', createdAt: '2026-06-01T00:00:00Z' }
  assert.equal(pickAgentPr([older, newer, open], '2026-07-02T00:00:00Z')?.number, 4, 'an open PR counts whatever its age')
  assert.equal(pickAgentPr([older, newer], '2026-07-02T00:00:00Z')?.number, 2, 'a predecessor\'s merged PR never does')
  assert.equal(pickAgentPr([older, newer, newest], '2026-07-02T00:00:00Z')?.number, 2, 'identity: the oldest of the run\'s own')
  assert.equal(pickAgentPr([older, newer, newest], '2026-07-02T00:00:00Z', 'latest')?.number, 3, 'the handoff decision: the last that saw the branch')
  assert.equal(pickAgentPr([older, newer]), undefined, 'without a start time only an open PR is trusted')
})

test('an existing PR is the Open PR answer, unless the session kept committing after it closed (#1255/#1512)', async () => {
  const { branches, forge, calls } = fakeBranches({ 'the-framework/work': state({ commits: [{ sha: 'tip0000000', subject: 'more' }] }), gone: state({ branch: 'gone', exists: false, commits: [], files: [] }) })
  const open = { number: 5, url: 'u5', state: 'OPEN', title: 'open' }
  assert.deepEqual(await openAgentPullRequest('/repo', agent(), { branches, pr: async () => open }), { ok: true, url: 'u5', number: 5 }, 'an open PR is the answer')
  // A hands-off web agent's branch only ever existed on the remote: its PR is still the answer.
  assert.deepEqual(await openAgentPullRequest('/repo', agent({ branch: 'gone' }), { branches, pr: async () => open }), { ok: true, url: 'u5', number: 5 })
  const landedHere = { number: 6, url: 'u6', state: 'MERGED', title: 'landed', createdAt: '2026-07-27T00:00:00Z', headRefOid: 'tip0000000' }
  assert.deepEqual(await openAgentPullRequest('/repo', agent(), { branches, pr: async () => landedHere }), { ok: true, url: 'u6', number: 6 }, 'a landed PR whose head is the tip: everything already landed')
  assert.deepEqual(calls.filter(call => call[0] === 'open'), [], 'nothing was opened for those')
  const landedBefore = { ...landedHere, headRefOid: 'older00000' }
  const opened = await openAgentPullRequest('/repo', agent(), { branches, forge, pr: async () => landedBefore })
  assert.deepEqual(opened, { ok: true, url: 'https://github.com/o/r/pull/9', number: 9 }, 'the session kept committing after its PR closed: the new work gets its own')
  assert.equal(calls.filter(call => call[0] === 'open').length, 1)
})

test('resolveAgentPr reads the PR the run recorded, and asks gh only for its state (E6)', async () => {
  const asked: (string | undefined)[] = []
  const live = { number: 41, url: 'https://github.com/o/r/pull/41', state: 'MERGED', title: 'the work' }
  const result = await resolveAgentPr('/repo', { id: 'r1', branch: 'agent-x', pr: { number: 41, url: 'https://github.com/o/r/pull/41' } }, async (_cwd, branch) => {
    asked.push(branch)
    return { value: live, pending: false }
  })
  assert.deepEqual(asked, ['agent-x'])
  assert.deepEqual(result, { value: live, pending: false })
})

test('resolveAgentPr answers nothing for a run that recorded no PR (E6)', async () => {
  let reads = 0
  const result = await resolveAgentPr('/repo', { id: 'r1', branch: 'agent-x' }, async () => (reads++, { value: undefined, pending: false }))
  assert.deepEqual(result, { value: undefined, pending: false })
  assert.equal(reads, 0, 'no PR recorded, no gh read')
})

test('a recorded PR the live read cannot confirm still answers with its number and url (E6)', async () => {
  const result = await resolveAgentPr('/repo', { id: 'r1', branch: 'agent-x', pr: { number: 41, url: 'u41' } }, async () => ({ value: undefined, pending: false }))
  assert.deepEqual(result, { value: { number: 41, url: 'u41', state: 'UNKNOWN', title: '' }, pending: false })
  const warming = await resolveAgentPr('/repo', { id: 'r1', branch: 'agent-x', pr: { number: 41, url: 'u41' } }, async () => ({ value: undefined, pending: true }))
  assert.deepEqual(warming, { value: { number: 41, url: 'u41', state: 'OPEN', title: '' }, pending: true })
})

test('a different PR on the branch is not this run’s answer (E6)', async () => {
  const other = { number: 40, url: 'u40', state: 'OPEN', title: 'someone else' }
  const result = await resolveAgentPr('/repo', { id: 'r1', branch: 'agent-x', pr: { number: 41, url: 'u41' } }, async () => ({ value: other, pending: false }))
  assert.deepEqual(result.value, { number: 41, url: 'u41', state: 'UNKNOWN', title: '' })
})

async function titleOf(handoffAgent: HandoffAgent): Promise<string | undefined> {
  const { branches, forge, calls } = fakeBranches({})
  await openRemoteBranchPullRequest('/repo', handoffAgent, 'claude/x', { branches, forge })
  return (calls.find(call => call[0] === 'open')?.[2] as { title: string } | undefined)?.title
}

test("a run implementing a ticket carries its issue as `(fix #42)` in the PR title (#1334)", async () => {
  // The squash-merge subject inherits the title, so this is what closes the ticket's issue on
  // merge; without it an auto-merged quick-win leaves its ticket open.
  assert.equal(await titleOf({ id: 'r1', branch: 'agent-fix-login', fixes: '#42' }), 'agent-fix-login (fix #42)')
})

test("the PR is titled with the agent's own name for the work (#1618)", async () => {
  // The first line of its `open-pr` block: the one rung that says what the change turned out to
  // be, in a whole sentence, rather than the branch the session happens to be on.
  const title = await titleOf({
    id: 'r1',
    branch: 'agent-queue-reader',
    prTitle: 'Keep the queued state across a reload',
    fixes: '#42',
  })
  assert.equal(title, 'Keep the queued state across a reload (fix #42)')
})

test('a session with no branch gets its id as the title, not the prompt it was given (#1618)', async () => {
  // The prompt used to be the middle rung, cut to 72 characters. The squash merge made that a
  // permanent commit subject: an instruction, truncated mid-sentence, standing in for a
  // description of the change. The session id says less and misleads nobody.
  const intent = 'Open TODO_AGENTS.md and work on the FIRST open entry only. When the work is done, close the ticket it links to.'
  assert.equal(await titleOf({ id: 'r1', intent }), 'Session r1')
  assert.equal(await titleOf({ id: 'r1', intent, fixes: '#1' }), 'Session r1 (fix #1)')
})

test("the Merge action lands the session's open PR through the forge (#1391)", async () => {
  const { forge, calls } = fakeBranches({})
  const result = await mergeAgentPr(
    '/repo',
    { id: 'r1', branch: 'the-framework/x', pr: { number: 7, url: 'https://github.com/o/r/pull/7' } },
    { forge, prs: async () => ({ value: { number: 7, url: 'https://github.com/o/r/pull/7', state: 'OPEN', title: 'x' }, pending: false }) },
  )
  assert.deepEqual(calls, [['merge', 7]])
  assert.deepEqual(result, { ok: true, url: 'https://github.com/o/r/pull/7', number: 7 })
})

test('the Merge action refuses a session with no PR, one already landed, and a project with no forge (#1391)', async () => {
  const { forge } = fakeBranches({})
  const none = await mergeAgentPr('/repo', { id: 'r1' }, { forge, prs: async () => ({ value: undefined, pending: false }) })
  assert.deepEqual(none, { ok: false, error: 'this session has no pull request to merge' })
  // A closed/merged PR is an answer, not an action: nothing to press twice.
  const open = { value: { number: 7, url: 'u', state: 'OPEN', title: 'x' }, pending: false }
  const landed = await mergeAgentPr('/repo', { id: 'r1', branch: 'the-framework/x', pr: { number: 7, url: 'u' } }, { forge, prs: async () => ({ ...open, value: { ...open.value, state: 'MERGED' } }) })
  assert.deepEqual(landed, { ok: false, error: "this session's PR is already merged" })
  const unprovided = await mergeAgentPr('/repo', { id: 'r1', branch: 'the-framework/x', pr: { number: 7, url: 'u' } }, { forge: noForge, prs: async () => open })
  assert.deepEqual(unprovided, { ok: false, error: 'this project has no forge package to merge with' })
})

test('a Merge the forge refuses comes back as the error, not a success (#1391)', async () => {
  const { forge } = fakeBranches({}, { merge: { ok: false, error: 'Pull request is not mergeable: the base branch requires review' } })
  const result = await mergeAgentPr(
    '/repo',
    { id: 'r1', branch: 'the-framework/x', pr: { number: 7, url: 'u' } },
    { forge, prs: async () => ({ value: { number: 7, url: 'u', state: 'OPEN', title: 'x' }, pending: false }) },
  )
  assert.deepEqual(result, { ok: false, error: 'Pull request is not mergeable: the base branch requires review' })
})

test("the Open PR button titles the request by the name the provider answers for the branch, before the branch itself; the agent's own title still wins", async () => {
  const { branches, forge, calls } = fakeBranches({ 'agent-fix-login': state({ branch: 'agent-fix-login', name: 'fix-login' }), 'agent-r1': state({ branch: 'agent-r1' }) })
  await openAgentPullRequest('/repo', agent({ branch: 'agent-fix-login' }), { branches, forge })
  assert.equal((calls.at(-1)![2] as { title: string }).title, 'fix-login')
  await openAgentPullRequest('/repo', agent({ branch: 'agent-r1' }), { branches, forge })
  assert.equal((calls.at(-1)![2] as { title: string }).title, 'agent-r1', 'no name answered: the branch as it is')
  await openRemoteBranchPullRequest('/repo', { id: 'r1', branch: 'agent-fix-login', prTitle: 'Fix the login redirect' }, 'agent-fix-login', { branches, forge })
  assert.equal((calls.at(-1)![2] as { title: string }).title, 'Fix the login redirect')
})
