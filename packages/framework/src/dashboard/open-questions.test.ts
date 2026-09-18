import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildOpenQuestions } from './open-questions.js'
import type { FrameworkEvent } from '../events.js'
import type { LiveAgent } from '../store/index.js'

const PROJECTS = [{ id: 'p1', path: '/one', name: 'one', activated: true }]

/** A run that ended on its question: `waiting`, its checkout kept. */
function liveAgent(overrides: Partial<LiveAgent> = {}): LiveAgent {
  return {
    status: 'waiting',
    id: 'run-1',
    startedAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T11:00:00.000Z',
    cwd: '/one/.branches/agent-run-1',
    ...overrides,
  }
}

const CHOICE: FrameworkEvent = {
  kind: 'choice',
  id: 'await-choices',
  title: 'Approve the plan?',
  options: [
    { id: 'yes', label: 'Approve' },
    { id: 'no', label: 'Decline' },
  ],
  recommended: 'yes',
}
const WAITING: FrameworkEvent = { kind: 'end', ok: false, waiting: true }

test('a waiting run yields its question whole, options and recommendation, read off the run\'s own diary (#1455/#1774)', async () => {
  const readFor: string[] = []
  const questions = await buildOpenQuestions(PROJECTS, {
    liveAgents: async () => [liveAgent({ branch: 'agent-triage', intent: 'triage the queue' })],
    events: async (cwd, agentId) => {
      readFor.push(`${cwd} ${agentId}`)
      return [CHOICE, WAITING]
    },
  })
  assert.deepEqual(readFor, ['/one run-1'])
  const { kind: _kind, ...choice } = CHOICE as FrameworkEvent & { kind: 'choice' }
  assert.deepEqual(questions, [
    {
      projectId: 'p1',
      projectName: 'one',
      agentId: 'run-1',
      sessionName: 'triage',
      intent: 'triage the queue',
      updatedAt: '2026-08-01T11:00:00.000Z',
      choice,
    },
  ])
})

test('a run that is working, one that ended for good, and a waiting one whose diary shows the agent went on contribute nothing', async () => {
  const questions = await buildOpenQuestions(PROJECTS, {
    liveAgents: async () => [
      liveAgent({ id: 'working', status: 'running' }),
      liveAgent({ id: 'stopped', status: 'stopped' }),
      // Waiting per the card, but the diary says the agent went on after the question: no card —
      // offering an answer the daemon would refuse is worse than one fewer.
      liveAgent({ id: 'went-on' }),
    ],
    events: async () => [CHOICE, WAITING, { kind: 'driver', event: { type: 'text', text: 'going on' } }],
  })
  assert.deepEqual(questions, [])
})

test('longest-waiting first: the run blocked longest is the one to unblock first', async () => {
  const questions = await buildOpenQuestions(PROJECTS, {
    liveAgents: async () => [
      liveAgent({ id: 'fresh', updatedAt: '2026-08-01T11:30:00.000Z' }),
      liveAgent({ id: 'stale', updatedAt: '2026-08-01T09:00:00.000Z' }),
    ],
    events: async () => [CHOICE, WAITING],
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
  // They share a agents-data archive, so the same web run is in both projects' agent lists.
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
