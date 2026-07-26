import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { buildOverview, buildRecentRuns, buildHotTickets, collectAllTickets, ticketBucket } from './overview.js'
import type { ProjectSummary } from './projects.js'
import type { ProjectQueue } from './queue.js'
import type { WorkspaceTicket } from './tickets.js'
import type { RunMeta } from '../store/index.js'

const project = (id: string, path: string, lastActivityAt?: string): ProjectSummary => ({
  id,
  path,
  name: id,
  activated: true,
  ...(lastActivityAt ? { lastActivityAt } : {}),
})

const meta = (status: RunMeta['status'], intent: string, updatedAt: string): RunMeta =>
  ({ version: 1, status, id: 'r', startedAt: updatedAt, updatedAt, passes: 0, intent }) as RunMeta

test('buildOverview surfaces only running runs, most-recently-updated first', async () => {
  const metas: Record<string, RunMeta> = {
    '/a': meta('running', 'build the API', '2026-07-13T10:00:00Z'),
    '/b': meta('done', 'finished thing', '2026-07-13T11:00:00Z'),
    '/c': meta('running', 'build the UI', '2026-07-13T12:00:00Z'),
  }
  const overview = await buildOverview([project('a', '/a'), project('b', '/b'), project('c', '/c')], {
    liveRuns: async cwd => (metas[cwd] ? [{ ...metas[cwd]!, cwd }] : []),
    queue: async () => [],
  })
  assert.deepEqual(
    overview.active.map(r => ({ id: r.projectId, intent: r.intent })),
    [
      { id: 'c', intent: 'build the UI' }, // newer updatedAt first
      { id: 'a', intent: 'build the API' },
    ],
  )
})

test('buildOverview sums the open queue and lists recent projects newest-first (capped at 5)', async () => {
  const projects = Array.from({ length: 7 }, (_, i) =>
    project(`p${i}`, `/p${i}`, `2026-07-${String(10 + i).padStart(2, '0')}T00:00:00Z`),
  )
  const queues: ProjectQueue[] = [
    { projectId: 'p0', projectName: 'p0', open: 3, total: 4, items: [] },
    { projectId: 'p1', projectName: 'p1', open: 2, total: 2, items: [] },
  ]
  const overview = await buildOverview(projects, { liveRuns: async () => [], queue: async () => queues })
  assert.equal(overview.active.length, 0)
  assert.equal(overview.queueOpen, 5)
  assert.equal(overview.recent.length, 5)
  assert.deepEqual(
    overview.recent.map(r => r.projectId),
    ['p6', 'p5', 'p4', 'p3', 'p2'], // newest-first, top 5
  )
})

test('buildOverview omits projects with no activity from recent', async () => {
  const overview = await buildOverview([project('a', '/a'), project('b', '/b', '2026-07-13T00:00:00Z')], {
    liveRuns: async () => [],
    queue: async () => [],
  })
  assert.deepEqual(overview.recent.map(r => r.projectId), ['b'])
})

const run = (id: string, startedAt: string): RunMeta =>
  ({ version: 1, status: 'done', id, startedAt, updatedAt: startedAt, passes: 0 }) as RunMeta

test('buildRecentRuns pools every project newest-first and tags each with its project', async () => {
  const runs: Record<string, RunMeta[]> = {
    '/a': [run('a2', '2026-07-13T12:00:00Z'), run('a1', '2026-07-13T09:00:00Z')],
    '/b': [run('b1', '2026-07-13T11:00:00Z')],
  }
  const recent = await buildRecentRuns([project('alpha', '/a'), project('beta', '/b')], {
    runs: async cwd => runs[cwd] ?? [],
  })
  assert.deepEqual(
    recent.map(r => ({ project: r.projectName, id: r.run.id })),
    [
      { project: 'alpha', id: 'a2' },
      { project: 'beta', id: 'b1' },
      { project: 'alpha', id: 'a1' },
    ],
  )
})

test('buildRecentRuns tolerates a project whose runs cannot be read', async () => {
  const recent = await buildRecentRuns([project('ok', '/ok'), project('bad', '/bad')], {
    runs: async cwd => {
      if (cwd === '/bad') throw new Error('unreadable')
      return [run('x', '2026-07-13T10:00:00Z')]
    },
  })
  assert.deepEqual(recent.map(r => r.run.id), ['x'])
})

const ticket = (file: string, over: Partial<WorkspaceTicket> = {}): WorkspaceTicket => ({
  file,
  title: file,
  summary: '',
  status: 'open',
  date: '2026-01-01T00:00:00.000Z',
  spiked: false,
  planned: false,
  ...over,
})

test('ticketBucket: in-progress > ai-queue > high-priority, else null (#1139)', () => {
  assert.equal(ticketBucket(ticket('a', { planned: true })), 'in-progress')
  assert.equal(ticketBucket(ticket('b', { spiked: true })), 'in-progress')
  assert.equal(ticketBucket(ticket('c', { priority: 'high' })), 'high-priority')
  assert.equal(ticketBucket(ticket('d', { priority: 'p1' })), 'high-priority')
  // Not in any of the three shown lanes: dropped from the card.
  assert.equal(ticketBucket(ticket('e')), null)
  assert.equal(ticketBucket(ticket('f', { priority: 'low' })), null)
  // A queued ticket lands in the AI Queue, and that outranks a bare priority flag.
  assert.equal(ticketBucket(ticket('g'), { queued: true }), 'ai-queue')
  assert.equal(ticketBucket(ticket('h', { priority: 'high' }), { queued: true }), 'ai-queue')
  // Work already under way outranks both: a planned (or queued-and-planned) ticket stays in-progress.
  assert.equal(ticketBucket(ticket('i', { planned: true, priority: 'high' })), 'in-progress')
  assert.equal(ticketBucket(ticket('j', { planned: true }), { queued: true }), 'in-progress')
})

test('ticketBucket: a bare number is the ticket format\'s 10-0 scale, high from 7 up', () => {
  // ticketing_format.md: `Priority: 10-0 … 10: critical — act immediately, 0: only if capacity`.
  for (const high of ['10', '9', '8', '7']) {
    assert.equal(ticketBucket(ticket(high, { priority: high })), 'high-priority', `priority ${high}`)
  }
  // 0 and 1 are that scale's LOWEST rungs — the inverse P0/P1 reading only applies written `p0`/`p1`.
  for (const low of ['6', '5', '2', '1', '0']) {
    assert.equal(ticketBucket(ticket(low, { priority: low })), null, `priority ${low}`)
  }
})

test('ticketBucket: a closed ticket is in no lane, whatever marks it left behind', () => {
  assert.equal(ticketBucket(ticket('a', { status: 'closed', planned: true })), null)
  assert.equal(ticketBucket(ticket('b', { status: 'closed', priority: '10' })), null)
  assert.equal(ticketBucket(ticket('c', { status: 'closed' }), { queued: true }), null)
  assert.equal(ticketBucket(ticket('d', { status: 'closed' }), { implementing: true }), null)
})

test('buildHotTickets pools every project, buckets each, drops the rest, and orders lane-first', async () => {
  const tickets: Record<string, WorkspaceTicket[]> = {
    '/a': [ticket('a1.md', { planned: true }), ticket('a2.md', { priority: 'high' })],
    '/b': [ticket('b1.md'), ticket('b2.md')],
  }
  const hot = await buildHotTickets([project('alpha', '/a'), project('beta', '/b')], {
    tickets: async cwd => tickets[cwd] ?? [],
    // beta's b1 is linked from its TODO_AGENTS.md, so it lands in the AI-Queue lane; b2 is in no
    // lane and drops off the card entirely.
    queue: async () => [
      { projectId: 'beta', projectName: 'beta', open: 1, total: 1, items: [{ text: '[b one](tickets/b1.md) — a note', done: false }] },
    ],
  })
  assert.deepEqual(
    hot.map(h => ({ p: h.projectName, f: h.ticket.file, b: h.bucket })),
    [
      { p: 'alpha', f: 'a1.md', b: 'in-progress' },
      { p: 'beta', f: 'b1.md', b: 'ai-queue' },
      { p: 'alpha', f: 'a2.md', b: 'high-priority' },
    ],
  )
})

// collectAllTickets backs the cross-project Tickets page (#1144): one list per project, unpooled
// and unbucketed — the opposite of buildHotTickets, which merges and filters for the Overview card.
test('collectAllTickets keeps one list per project, in registry order', async () => {
  const tickets: Record<string, WorkspaceTicket[]> = {
    '/a': [ticket('a1.md'), ticket('a2.md')],
    '/b': [ticket('b1.md')],
  }
  const all = await collectAllTickets([project('alpha', '/a'), project('beta', '/b')], {
    tickets: async cwd => tickets[cwd] ?? [],
  })
  assert.deepEqual(
    all.map(g => ({ id: g.projectId, files: g.tickets.map(t => t.file) })),
    [
      { id: 'alpha', files: ['a1.md', 'a2.md'] },
      { id: 'beta', files: ['b1.md'] },
    ],
  )
})

test('collectAllTickets keeps a project with no tickets, so import stays reachable there (#1144)', async () => {
  const all = await collectAllTickets([project('empty', '/e')], { tickets: async () => [] })
  assert.deepEqual(all, [{ projectId: 'empty', projectName: 'empty', tickets: [] }])
})

test('collectAllTickets tolerates a project whose tickets cannot be read (#1144)', async () => {
  const all = await collectAllTickets([project('bad', '/bad')], {
    tickets: async () => {
      throw new Error('nope')
    },
  })
  assert.deepEqual(all, [{ projectId: 'bad', projectName: 'bad', tickets: [] }])
})

test('buildHotTickets tolerates a project whose tickets cannot be read', async () => {
  const hot = await buildHotTickets([project('ok', '/ok'), project('bad', '/bad')], {
    tickets: async cwd => {
      if (cwd === '/bad') throw new Error('unreadable')
      return [ticket('x.md', { priority: 'high' })]
    },
    queue: async () => [],
  })
  assert.deepEqual(hot.map(h => h.ticket.file), ['x.md'])
})

/** A live run meta carrying the ticket it is implementing (#1117). */
const runOn = (id: string, ticket: string, status: RunMeta['status'] = 'running') =>
  ({ version: 1, status, id, startedAt: 't', updatedAt: 't', passes: 0, ticket, cwd: '/w' }) as never

test('ticketBucket: a run implementing it is in-progress, whatever the plan/spike says (#1117)', () => {
  // The whole point of the link: a ticket nobody has planned yet, being coded right now, would
  // otherwise fall through to a non-shown lane on the strength of a plan/spike file alone.
  assert.equal(ticketBucket(ticket('a'), { implementing: true }), 'in-progress')
  assert.equal(ticketBucket(ticket('b', { priority: 'high' }), { implementing: true }), 'in-progress')
  // Absent evidence, the #1112 inference is untouched.
  assert.equal(ticketBucket(ticket('c', { planned: true }), { implementing: false }), 'in-progress')
  assert.equal(ticketBucket(ticket('d'), { implementing: false }), null)
})

test('buildHotTickets marks the ticket a live run is implementing, with its run id (#1117)', async () => {
  const hot = await buildHotTickets([project('alpha', '/a')], {
    tickets: async () => [ticket('2026-07-25_login.md'), ticket('2026-07-26_other.md')],
    liveRuns: async () => [runOn('run-7', 'tickets/2026-07-25_login.md')],
    queue: async () => [],
  })
  const login = hot.find(h => h.ticket.file === '2026-07-25_login.md')
  assert.equal(login?.bucket, 'in-progress', 'the ticket being coded is in progress')
  assert.equal(login?.runId, 'run-7', 'and carries the run, so the card can link into it')
  // The ticket nobody is on and nothing queues is in no lane, so it drops off the card (#1139).
  const other = hot.find(h => h.ticket.file === '2026-07-26_other.md')
  assert.equal(other, undefined)
})

test('buildHotTickets ignores a finished run and another project\'s ticket (#1117)', async () => {
  // A run that has ended is not implementing anything, however recently it stopped — so x.md carries
  // no runId and sits in the AI Queue by its link alone.
  const finished = await buildHotTickets([project('alpha', '/a')], {
    tickets: async () => [ticket('x.md')],
    liveRuns: async () => [runOn('run-7', 'tickets/x.md', 'done')],
    queue: async () => [{ projectId: 'alpha', projectName: 'alpha', open: 1, total: 1, items: [{ text: '[x](tickets/x.md)', done: false }] }],
  })
  assert.equal(finished[0]?.runId, undefined)
  assert.equal(finished[0]?.bucket, 'ai-queue')

  // A ticket path is only unique inside its own repo, so beta's run must not light up alpha's
  // identically-named ticket. alpha's x.md is in no lane (no run, no queue link, no priority), so
  // only beta's implementing copy survives.
  const twoProjects = await buildHotTickets([project('alpha', '/a'), project('beta', '/b')], {
    tickets: async () => [ticket('x.md')],
    liveRuns: async cwd => (cwd === '/b' ? [runOn('run-9', 'tickets/x.md')] : []),
    queue: async () => [],
  })
  assert.deepEqual(
    twoProjects.map(h => ({ p: h.projectName, run: h.runId })),
    [{ p: 'beta', run: 'run-9' }],
    'only beta reads as implementing; alpha\'s same-named ticket is in no lane and drops off',
  )
})
