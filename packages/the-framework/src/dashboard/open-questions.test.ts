import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildOpenQuestions, openChoiceRequest } from './open-questions.js'
import type { FrameworkEvent } from '../events.js'
import type { LiveAgent } from '../store/index.js'

const PROJECTS = [{ id: 'p1', path: '/one', name: 'one', activated: true }]

function liveAgent(overrides: Partial<LiveAgent> = {}): LiveAgent {
  return {
    status: 'running',
    id: 'run-1',
    startedAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T11:00:00.000Z',
    cwd: '/one/.the-framework/worktrees/run-1',
    pendingChoice: { id: 'gate-1', title: 'Approve the plan?' },
    ...overrides,
  }
}

const CHOICE: FrameworkEvent = {
  kind: 'choice',
  id: 'gate-1',
  title: 'Approve the plan?',
  options: [
    { id: 'yes', label: 'Approve' },
    { id: 'no', label: 'Decline' },
  ],
  recommended: 'yes',
}

test('openChoiceRequest keeps the whole request — options and recommended', () => {
  const open = openChoiceRequest([CHOICE], 'gate-1')
  assert.deepEqual(open, {
    id: 'gate-1',
    title: 'Approve the plan?',
    options: [
      { id: 'yes', label: 'Approve' },
      { id: 'no', label: 'Decline' },
    ],
    recommended: 'yes',
  })
})

test('a resolved gate is closed, and a re-fired one is open again', () => {
  const resolved: FrameworkEvent = { kind: 'choice-resolved', id: 'gate-1', picked: 'yes', by: 'user' }
  assert.equal(openChoiceRequest([CHOICE, resolved], 'gate-1'), undefined)
  assert.notEqual(openChoiceRequest([CHOICE, resolved, CHOICE], 'gate-1'), undefined)
})

test('a parked run yields its question with the full gate, read from the run own checkout (#1455)', async () => {
  const readFrom: string[] = []
  const questions = await buildOpenQuestions(PROJECTS, {
    liveAgents: async () => [liveAgent({ sessionName: 'triage', intent: 'triage the queue' })],
    events: async cwd => {
      readFrom.push(cwd)
      return [CHOICE]
    },
  })
  assert.deepEqual(readFrom, ['/one/.the-framework/worktrees/run-1'])
  assert.equal(questions.length, 1)
  assert.deepEqual(questions[0], {
    projectId: 'p1',
    projectName: 'one',
    agentId: 'run-1',
    sessionName: 'triage',
    intent: 'triage the queue',
    updatedAt: '2026-08-01T11:00:00.000Z',
    choice: openChoiceRequest([CHOICE], 'gate-1'),
  })
})

test('not-running, not-parked, and already-resolved runs contribute nothing', async () => {
  const questions = await buildOpenQuestions(PROJECTS, {
    liveAgents: async () => [
      liveAgent({ id: 'stopped', status: 'stopped' }),
      (() => {
        const { pendingChoice: _open, ...working } = liveAgent({ id: 'working' })
        return working as LiveAgent
      })(),
      // Parked per the meta, but the log says the gate was already answered: no card — offering
      // an answer the daemon would refuse is worse than one fewer.
      liveAgent({ id: 'resolved' }),
    ],
    events: async () => [CHOICE, { kind: 'choice-resolved', id: 'gate-1', picked: 'yes', by: 'user' }],
  })
  assert.deepEqual(questions, [])
})

test('longest-waiting first: the run blocked longest is the one to unblock first', async () => {
  const questions = await buildOpenQuestions(PROJECTS, {
    liveAgents: async () => [
      liveAgent({ id: 'fresh', updatedAt: '2026-08-01T11:30:00.000Z' }),
      liveAgent({ id: 'stale', updatedAt: '2026-08-01T09:00:00.000Z' }),
    ],
    events: async () => [CHOICE],
  })
  assert.deepEqual(questions.map(q => q.agentId), ['stale', 'fresh'])
})

test('an unreadable project or log contributes nothing rather than failing the read', async () => {
  const questions = await buildOpenQuestions(
    [...PROJECTS, { id: 'p2', path: '/two', name: 'two', activated: true }],
    {
      liveAgents: async cwd => {
        if (cwd === '/two') throw new Error('unreadable')
        return [liveAgent()]
      },
      events: async () => {
        throw new Error('torn log')
      },
    },
  )
  assert.deepEqual(questions, [])
})

test('a web agent\'s question arrives from the bridge and is answerable by label (#1554)', async () => {
  const questions = await buildOpenQuestions(PROJECTS, {
    liveAgents: async () => [],
    events: async () => [],
    bridged: () => [
      {
        sessionId: 'session_01Web',
        title: 'Which checks should run?',
        options: [{ label: 'Lint', default: true }, { label: 'Tests', detail: 'slow' }],
        multi: true,
        receivedAt: '2026-08-23T09:30:00.000Z',
      },
    ],
    // The archive, not the live reader: a web agent is done at its hand-off and its checkout may
    // be gone, but the hub still has to find the run the question belongs to.
    agents: async () => [
      { status: 'done', id: 'run-web', startedAt: '2026-08-23T09:00:00.000Z', updatedAt: '2026-08-23T09:01:00.000Z', target: 'web', sessionId: 'session_01Web', intent: 'add CI' },
      { status: 'done', id: 'run-other', startedAt: '2026-08-23T08:00:00.000Z', updatedAt: '2026-08-23T08:01:00.000Z', target: 'web', sessionId: 'session_01Other' },
    ],
  })
  assert.deepEqual(questions, [
    {
      projectId: 'p1',
      projectName: 'one',
      agentId: 'run-web',
      intent: 'add CI',
      choice: {
        id: 'bridge:session_01Web',
        title: 'Which checks should run?',
        options: [
          { id: 'Lint', label: 'Lint', default: true },
          { id: 'Tests', label: 'Tests', detail: 'slow' },
        ],
        multi: true,
      },
      // Parked since the bridge saw it: that is the wait the order sorts on, not the hand-off.
      updatedAt: '2026-08-23T09:30:00.000Z',
      bridge: { sessionId: 'session_01Web', url: 'https://claude.ai/code/session_01Web' },
    },
  ])
})

test('two checkouts of one repository yield one card for a bridged question, not two (#1554)', async () => {
  // They share a tf-data archive, so the same web run is in both projects' agent lists.
  const agents = async () => [{ status: 'done' as const, id: 'run-web', startedAt: '', updatedAt: '', target: 'web' as const, sessionId: 'session_01Web' }]
  const questions = await buildOpenQuestions([PROJECTS[0]!, { id: 'p2', path: '/two', name: 'two', activated: true }], {
    liveAgents: async () => [],
    events: async () => [],
    bridged: () => [{ sessionId: 'session_01Web', title: 'Where?', options: [{ label: 'Here' }], receivedAt: '' }],
    agents,
  })
  assert.deepEqual(questions.map(q => q.projectId), ['p1'])
})

test('a bridged question whose run is unknown here, or already has an answer on its way, is not offered (#1554)', async () => {
  let archiveReads = 0
  const orphan = await buildOpenQuestions(PROJECTS, {
    liveAgents: async () => [],
    events: async () => [],
    bridged: () => [{ sessionId: 'session_01Gone', title: 'Still there?', options: [{ label: 'Yes' }], receivedAt: '' }],
    agents: async () => {
      archiveReads++
      return []
    },
  })
  assert.deepEqual(orphan, [])
  assert.equal(archiveReads, 1)
  // Nothing bridged: the archive is not even read.
  await buildOpenQuestions(PROJECTS, {
    liveAgents: async () => [],
    events: async () => [],
    bridged: () => [],
    agents: async () => {
      archiveReads++
      return []
    },
  })
  assert.equal(archiveReads, 1)
})
