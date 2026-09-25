import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { buildInterventions, interventionKey } from './interventions.js'
import type { OpenPr } from './pull-requests.js'
import type { BranchState, BranchesFor } from '../store/branches.js'
import type { ProjectSummary } from './projects.js'
import type { LiveAgent, AgentMeta } from '../store/index.js'
import type { FrameworkEvent } from '../events.js'

const project = (id: string, path: string): ProjectSummary => ({ id, path, name: id, activated: true })

/** No paused run anywhere — keeps the PR-only tests hermetic (no disk read). */
const noAgents = async (): Promise<LiveAgent[]> => []

/** A live agent in its own worktree (#738), which is what the reader now returns. */
const live = (meta: AgentMeta, cwd = '/a/.the-framework/worktrees/r1'): LiveAgent => ({ ...meta, cwd })

const runningAgentMeta = (over: Partial<AgentMeta> = {}): AgentMeta => ({
  status: 'running',
  id: 'r1',
  startedAt: '2026-07-16T00:00:00Z',
  updatedAt: '2026-07-16T00:00:00Z',
  ...over,
})

test('buildInterventions rolls up open non-draft PRs across projects, newest first', async () => {
  const prsByPath: Record<string, OpenPr[]> = {
    '/a': [
      { number: 7, title: 'add cart', url: 'u7', isDraft: false, createdAt: '2026-07-10T00:00:00Z' },
      { number: 8, title: 'wip spike', url: 'u8', isDraft: true, createdAt: '2026-07-12T00:00:00Z' }, // draft -> excluded
    ],
    '/b': [{ number: 3, title: 'fix login', url: 'u3', isDraft: false, createdAt: '2026-07-15T00:00:00Z' }],
    '/c': [], // no open PRs -> contributes nothing
  }
  const prs = async (cwd: string): Promise<OpenPr[]> => prsByPath[cwd] ?? []
  const { items } = await buildInterventions([project('a', '/a'), project('b', '/b'), project('c', '/c')], { prs, liveAgents: noAgents })

  // Newest PR first; the draft is gone.
  assert.deepEqual(
    items.map(i => ({ project: i.projectId, number: i.number, title: i.title })),
    [
      { project: 'b', number: 3, title: 'fix login' },
      { project: 'a', number: 7, title: 'add cart' },
    ],
  )
  assert.ok(items.every(i => i.kind === 'pr'))
})

test('buildInterventions skips a project whose PR lookup throws, and does not call it read (#1623)', async () => {
  const prs = async (cwd: string): Promise<OpenPr[]> => {
    if (cwd === '/boom') throw new Error('gh exploded')
    return [{ number: 1, title: 'ok', url: 'u1', isDraft: false }]
  }
  const { items, whole } = await buildInterventions([project('boom', '/boom'), project('ok', '/ok')], { prs, liveAgents: noAgents })
  assert.deepEqual(items.map(i => i.projectId), ['ok'])
  // Both projects contributed nothing visible about /boom; only `whole` says which silence was real.
  assert.deepEqual(whole, ['ok'])
})

test('buildInterventions calls a project read when it answers with nothing (#1623)', async () => {
  const prs = async (): Promise<OpenPr[]> => []
  const { items, whole } = await buildInterventions([project('quiet', '/quiet')], { prs, liveAgents: noAgents })
  assert.deepEqual(items, [])
  assert.deepEqual(whole, ['quiet'])
})

test('buildInterventions does not call a project read when its live-agent read throws (#1623)', async () => {
  const liveAgents = async (): Promise<LiveAgent[]> => {
    throw new Error('store unreadable')
  }
  const prs = async (): Promise<OpenPr[]> => [{ number: 7, title: 'open', url: 'u7', isDraft: false }]
  const { items, whole } = await buildInterventions([project('a', '/a')], { prs, liveAgents })
  // The PRs it did read are still shown — forgiving as ever — but the project is not a baseline.
  assert.deepEqual(items.map(i => i.number), [7])
  assert.deepEqual(whole, [])
})

test('buildInterventions returns [] when nothing is open anywhere', async () => {
  const prs = async (): Promise<OpenPr[]> => []
  assert.deepEqual((await buildInterventions([project('a', '/a')], { prs, liveAgents: noAgents })).items, [])
})

test('buildInterventions dedupes a PR shared by two registered projects (same repo), keeping one', async () => {
  const shared: OpenPr = { number: 285, title: 'release', url: 'https://gh/pr/285', isDraft: false, createdAt: '2026-07-05T00:00:00Z' }
  const prs = async (): Promise<OpenPr[]> => [shared] // both projects resolve to the same repo
  const { items } = await buildInterventions([project('root', '/repo'), project('sub', '/repo/packages/x')], { prs, liveAgents: noAgents })
  assert.deepEqual(items.map(i => i.number), [285])
})

const noPrs = async (): Promise<OpenPr[]> => []

/** A run that ended on a question: its meta says `waiting`, its diary holds the question. */
const waitingOn = (id: string, title: string): FrameworkEvent[] => [
  { kind: 'choice', id, title, options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] },
  { kind: 'end', ok: false, waiting: true },
]

test('buildInterventions adds an awaiting item for a run waiting on the question it ended on (#636/#1774)', async () => {
  const liveAgents = async (cwd: string): Promise<LiveAgent[]> => (cwd === '/a' ? [live(runningAgentMeta({ status: 'waiting' }))] : [])
  const read: string[] = []
  const events = async (cwd: string, agentId: string) => (read.push(`${cwd} ${agentId}`), waitingOn('gate-1', 'Cache the auth store?'))
  const { items } = await buildInterventions([project('a', '/a'), project('b', '/b')], { prs: noPrs, liveAgents, events })

  assert.equal(items.length, 1)
  assert.deepEqual(
    { kind: items[0]!.kind, project: items[0]!.projectId, title: items[0]!.title, awaitId: items[0]!.awaitId, agentId: items[0]!.agentId },
    { kind: 'awaiting', project: 'a', title: 'Cache the auth store?', awaitId: 'gate-1', agentId: 'r1' },
  )
  assert.deepEqual(read, ['/a r1'], "only the waiting run's diary is read")
})

test('buildInterventions adds no awaiting item for a run that is not waiting, or whose diary shows no open question', async () => {
  const events = async () => waitingOn('gate-1', 'stale')
  const running = async (): Promise<LiveAgent[]> => [live(runningAgentMeta())]
  assert.deepEqual((await buildInterventions([project('a', '/a')], { prs: noPrs, liveAgents: running, events })).items, [])
  const waiting = async (): Promise<LiveAgent[]> => [live(runningAgentMeta({ status: 'waiting' }))]
  const answered = async (): Promise<FrameworkEvent[]> => [...waitingOn('gate-1', 'q?'), { kind: 'driver', event: { type: 'start', prompt: 'Yes' } }]
  assert.deepEqual((await buildInterventions([project('a', '/a')], { prs: noPrs, liveAgents: waiting, events: answered })).items, [])
  const unreadable = async () => undefined
  assert.deepEqual((await buildInterventions([project('a', '/a')], { prs: noPrs, liveAgents: waiting, events: unreadable })).items, [])
})

test('buildInterventions surfaces PRs and awaiting runs together, newest first', async () => {
  const prs = async (cwd: string): Promise<OpenPr[]> =>
    cwd === '/a' ? [{ number: 5, title: 'pr', url: 'u5', isDraft: false, createdAt: '2026-07-10T00:00:00Z' }] : []
  const liveAgents = async (cwd: string): Promise<LiveAgent[]> =>
    cwd === '/b' ? [live(runningAgentMeta({ status: 'waiting', updatedAt: '2026-07-16T00:00:00Z' }))] : []
  const { items } = await buildInterventions([project('a', '/a'), project('b', '/b')], { prs, liveAgents, events: async () => waitingOn('g', 'q?') })
  assert.deepEqual(items.map(i => i.kind), ['awaiting', 'pr']) // awaiting is newer
})

test('interventionKey is the url for a PR and project+agent+gate for an awaiting run', () => {
  assert.equal(
    interventionKey({ projectId: 'a', projectName: 'a', kind: 'pr', title: 't', url: 'https://gh/pr/1', number: 1 }),
    'https://gh/pr/1',
  )
  assert.equal(
    interventionKey({ projectId: 'a', projectName: 'a', kind: 'awaiting', title: 't', url: '', awaitId: 'g1', agentId: 'r1' }),
    'awaiting:a:r1:g1',
  )
  // Every agent's first gate is `await-choices`, so two agents parked in one project would share
  // an identity without the run in the key — and the dedupe would announce only one of them.
  const parked = { projectId: 'a', projectName: 'a', kind: 'awaiting', title: 't', url: '', awaitId: 'await-choices' } as const
  assert.notEqual(interventionKey({ ...parked, agentId: 'r1' }), interventionKey({ ...parked, agentId: 'r2' }))
})

// #860: a finished agent whose branch still holds unpushed, unmerged commits.

const doneMeta = (over: Partial<AgentMeta> = {}): AgentMeta => ({
  status: 'done',
  id: 'r1',
  startedAt: '2026-07-16T00:00:00Z',
  updatedAt: '2026-07-16T01:00:00Z',
  branch: 'the-framework/add-cart',
  intent: 'add the cart',
  ...over,
})

/** A branch with work on it that never left the machine, as the branches provider answers it. */
const waiting = (over: Partial<BranchState> = {}): BranchState => ({
  branch: 'the-framework/add-cart',
  exists: true,
  base: 'main',
  commits: [{ sha: 'abc1234', subject: 'add the cart' }],
  files: [{ path: 'cart.ts', insertions: 3, deletions: 0, binary: false }],
  hasRemote: true,
  pushed: false,
  merged: false,
  ...over,
})

/** A branches provider answering `show` from `state`, one answer per branch asked, recording what it was asked. */
const showing = (state: (branch: string) => BranchState | undefined, asked: string[][] = []): BranchesFor => {
  const unused = () => Promise.reject(new Error('not asked here'))
  return async () => ({
    list: unused,
    show: async branches => {
      asked.push([...branches])
      return branches.flatMap(branch => {
        const answer = state(branch)
        return answer ? [answer] : []
      })
    },
    push: unused,
    remove: unused,
  })
}

/** Only the unpushed source: no PRs, no paused runs. */
const onlyUnpushed = (agents: AgentMeta[], branches: BranchesFor) => ({
  prs: async () => [],
  liveAgents: noAgents,
  agents: async () => agents,
  branches,
})

test('a finished run with unpushed commits lands on the queue (#860)', async () => {
  const { items } = await buildInterventions(
    [project('a', '/a')],
    onlyUnpushed([doneMeta()], showing(branch => waiting({ branch }))),
  )

  assert.equal(items.length, 1)
  assert.equal(items[0]?.kind, 'unpushed')
  assert.equal(items[0]?.title, 'add the cart', 'what was asked, not the branch name')
  assert.equal(items[0]?.branch, 'the-framework/add-cart')
  assert.equal(items[0]?.commits, 1)
  assert.equal(items[0]?.agentId, 'r1')
})

test('nothing is waiting when the work already went somewhere (#860)', async () => {
  // Each of these is a reason it is NOT waiting on a human.
  const cases: [string, Partial<BranchState>][] = [
    ['already pushed', { pushed: true }],
    ['already merged', { merged: true }],
    ['the session wrote nothing', { commits: [] }],
    ['the session\'s commits net to no change', { files: [] }],
    ['the branch is gone', { exists: false }],
    ['there is nowhere to push', { hasRemote: false }],
    ['the provider did not answer for the branch', undefined as unknown as Partial<BranchState>],
  ]
  for (const [why, over] of cases) {
    const { items } = await buildInterventions(
      [project('a', '/a')],
      onlyUnpushed([doneMeta()], showing(branch => (over ? waiting({ branch, ...over }) : undefined))),
    )
    assert.deepEqual(items, [], `should not be surfaced: ${why}`)
  }
})

test('a still-running run is not unpushed work (#860)', async () => {
  // It is still writing; the overview already shows it.
  const { items } = await buildInterventions(
    [project('a', '/a')],
    onlyUnpushed([doneMeta({ status: 'running' })], showing(branch => waiting({ branch }))),
  )
  assert.deepEqual(items, [])
})

test('an unreadable branch state is skipped rather than throwing, and the project does not count as read whole (#860)', async () => {
  const failing: BranchesFor = async () => ({
    list: async () => [],
    show: async () => {
      throw new Error('not a repo')
    },
    push: async () => ({ ok: false, error: 'no' }),
    remove: async () => ({ ok: false, error: 'no' }),
  })
  const { items, whole } = await buildInterventions([project('a', '/a')], onlyUnpushed([doneMeta()], failing))
  assert.deepEqual(items, [])
  assert.deepEqual(whole, [])
})

test('a project with no branches provider has nothing unpushed (#1774)', async () => {
  const { items, whole } = await buildInterventions([project('a', '/a')], onlyUnpushed([doneMeta()], async () => undefined))
  assert.deepEqual(items, [])
  assert.deepEqual(whole, ['a'])
})

test('only the most recent finished runs are inspected (#860)', async () => {
  // Each read of the provider is a process on a poll, and work sitting unpushed for dozens of
  // runs is not news: the newest few, in ONE read.
  const agents = Array.from({ length: 12 }, (_, i) =>
    doneMeta({ id: `r${i}`, startedAt: `2026-07-${String(i + 1).padStart(2, '0')}T00:00:00Z`, branch: `b${i}` }),
  )
  const asked: string[][] = []
  const { items } = await buildInterventions(
    [project('a', '/a')],
    { ...onlyUnpushed(agents, showing(branch => waiting({ branch }), asked)), handoffLimit: 3 },
  )

  assert.deepEqual(asked, [['b11', 'b10', 'b9']], 'the newest three, by start time, asked at once')
  assert.equal(items.length, 3)
})

test('unpushed items key on the run, so each notifies once (#860)', () => {
  const base = { projectId: 'p', projectName: 'p', kind: 'unpushed' as const, title: 't', url: '' }
  assert.equal(interventionKey({ ...base, agentId: 'r1' }), 'unpushed:p:r1')
  assert.notEqual(interventionKey({ ...base, agentId: 'r1' }), interventionKey({ ...base, agentId: 'r2' }))
  // And never collides with the other kinds, whose url is the same shared dashboard URL.
  assert.notEqual(
    interventionKey({ ...base, agentId: 'r1' }),
    interventionKey({ ...base, kind: 'awaiting', awaitId: 'r1' }),
  )
})

test("a session's own draft PR still reaches the queue; a hand-made draft does not (#1102)", async () => {
  // Auto-handoff opens a draft precisely so it does not ping reviewers. If the queue then dropped
  // it too, nothing would tell anyone the work exists, which is #860 all over again.
  const prs = async (): Promise<OpenPr[]> => [
    { number: 9, title: 'session work', url: 'u9', isDraft: true, headRefName: 'agent-x', createdAt: '2026-07-16T00:00:00Z' },
    { number: 10, title: 'my own wip', url: 'u10', isDraft: true, headRefName: 'feat/mine', createdAt: '2026-07-17T00:00:00Z' },
  ]
  // A draft is a run's when its head is the branch a run's record, or a run's checkout, names (#1774).
  const recorded: AgentMeta = { id: 'x', status: 'done', startedAt: '2026-07-16T00:00:00Z', updatedAt: '2026-07-16T01:00:00Z', branch: 'agent-x' }
  const { items } = await buildInterventions([project('a', '/a')], { prs, liveAgents: noAgents, agents: async () => [recorded] })
  assert.deepEqual(items.map(i => i.number), [9])
  const { items: live } = await buildInterventions([project('a', '/a')], { prs, liveAgents: async () => [{ ...recorded, status: 'running', cwd: '/a/.branches/agent-x' }], agents: async () => [] })
  assert.deepEqual(live.map(i => i.number), [9], 'a running agent\'s draft counts too')
  const { items: nobody } = await buildInterventions([project('a', '/a')], { prs, liveAgents: noAgents, agents: async () => [] })
  assert.deepEqual(nobody, [], 'a draft on a branch no run names is hand-made')
})

test('a draft with no branch recorded is still treated as hand-made (#1102)', async () => {
  // `headRefName` is new: an older gh, or a lookup that did not ask for it, must not turn every
  // draft in the repo into a "needs you".
  const prs = async (): Promise<OpenPr[]> => [{ number: 11, title: 'wip', url: 'u11', isDraft: true }]
  const { items } = await buildInterventions([project('a', '/a')], { prs, liveAgents: noAgents, agents: async () => [] })
  assert.deepEqual(items, [])
})

test('unpushed work of an agent that recorded no ask is titled by the name the provider answers for its branch, else the branch', async () => {
  const { intent: _intent, ...unasked } = doneMeta({ branch: 'agent-fix-login' })
  const named = await buildInterventions([project('p', '/p')], onlyUnpushed([unasked], showing(branch => waiting({ branch, name: 'fix-login' }))))
  assert.deepEqual(named.items.map(i => [i.kind, i.title, i.branch]), [['unpushed', 'fix-login', 'agent-fix-login']])
  const plain = await buildInterventions([project('p', '/p')], onlyUnpushed([unasked], showing(branch => waiting({ branch }))))
  assert.deepEqual(plain.items.map(i => i.title), ['agent-fix-login'], 'no name answered: the branch as it is')
})
