import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { SeenTracker, startKeyedWatcher } from './keyed-watcher.js'
import { activityKey, type Activity } from './activity.js'
import { interventionKey, type Intervention } from './interventions.js'
import type { ProjectSummary } from './projects.js'

const pr = (n: number, url: string, project = 'p'): Intervention => ({
  projectId: project,
  projectName: project,
  kind: 'pr',
  number: n,
  title: `pr ${n}`,
  url,
})

const projectOf = (item: { projectId: string }): string => item.projectId

const started = (agentId: string): Activity => ({ projectId: 'p', projectName: 'p', kind: 'started', agentId })
const finished = (agentId: string): Activity => ({ projectId: 'p', projectName: 'p', kind: 'finished', agentId, status: 'done' })

test('SeenTracker seeds a baseline on the first poll, then returns only new items', () => {
  const tracker = new SeenTracker(interventionKey, projectOf)
  // First poll = the queue that already existed at start-up: baseline, nothing announced.
  assert.deepEqual(tracker.observe([pr(1, 'u1')], ['p']), [])
  // A new PR appears next poll -> just that one.
  assert.deepEqual(tracker.observe([pr(1, 'u1'), pr(2, 'u2')], ['p']).map(i => i.number), [2])
  // Nothing new -> empty.
  assert.deepEqual(tracker.observe([pr(1, 'u1'), pr(2, 'u2')], ['p']), [])
})

test('SeenTracker keys on the caller\'s identity, so a run started and finished are two announcements', () => {
  const tracker = new SeenTracker(activityKey, projectOf)
  assert.deepEqual(tracker.observe([started('r1')], ['p']), [])
  // The same agent finishing is a new key -> announced.
  assert.deepEqual(tracker.observe([finished('r1')], ['p']).map(i => i.kind), ['finished'])
  assert.deepEqual(tracker.observe([finished('r1')], ['p']), [])
})

test('startKeyedWatcher announces only items that appear after the first poll', async () => {
  const projects = async (): Promise<ProjectSummary[]> => [{ id: 'a', path: '/a', name: 'a', activated: true }]
  let current: Intervention[] = [pr(1, 'u1')]
  const announced: number[][] = []
  const watcher = startKeyedWatcher({
    projects,
    build: async () => ({ items: current, whole: ['p'] }),
    keyOf: interventionKey,
    scopeOf: projectOf,
    onNew: items => void announced.push(items.map(i => i.number!)),
  })
  try {
    // The watcher owns no timer (E4): the daemon's clock drives it, and its first turn is the
    // baseline seed — which must happen, or the whole open backlog reads as new.
    await watcher.poll()
    assert.deepEqual(announced, []) // baseline announces nothing
    current = [pr(1, 'u1'), pr(2, 'u2')]
    await watcher.poll() // u2 is new -> announced
    assert.deepEqual(announced, [[2]])
  } finally {
    watcher.stop()
  }
})

test('startKeyedWatcher yields no new items when the scan or the projection fails', async () => {
  const announced: unknown[][] = []
  const watcher = startKeyedWatcher<Intervention>({
    projects: async () => {
      throw new Error('registry unreadable')
    },
    build: async () => {
      throw new Error('projection failed')
    },
    keyOf: interventionKey,
    scopeOf: projectOf,
    onNew: items => void announced.push(items),
  })
  try {
    await watcher.poll()
    assert.deepEqual(announced, [])
  } finally {
    watcher.stop()
  }
})

test('a failed first poll does not seed the baseline, so the backlog is not announced as new', async () => {
  const projects = async (): Promise<ProjectSummary[]> => [{ id: 'a', path: '/a', name: 'a', activated: true }]
  let failing = true
  const announced: number[][] = []
  const watcher = startKeyedWatcher({
    projects,
    build: async () => {
      if (failing) throw new Error('projection failed')
      return { items: [pr(1, 'u1')], whole: ['p'] }
    },
    keyOf: interventionKey,
    scopeOf: projectOf,
    onNew: items => void announced.push(items.map(i => i.number!)),
  })
  try {
    await watcher.poll() // fails — must NOT count as the baseline
    failing = false
    await watcher.poll() // first real read: this is the baseline, pre-existing pr(1) stays silent
    assert.deepEqual(announced, [])
    await watcher.poll() // and it stays silent on the next poll too — seen, not new
    assert.deepEqual(announced, [])
  } finally {
    watcher.stop()
  }
})

test('a first poll that read nothing whole is not a baseline: the backlog is not announced (#1623)', async () => {
  const projects = async (): Promise<ProjectSummary[]> => [{ id: 'p', path: '/p', name: 'p', activated: true }]
  // What a boot with no GitHub reach actually looks like from here: the poll *succeeds*, with an
  // empty list, because every read underneath it forgave its own failure.
  let reachable = false
  const announced: number[][] = []
  const watcher = startKeyedWatcher({
    projects,
    build: async () => (reachable ? { items: [pr(1, 'u1'), pr(2, 'u2')], whole: ['p'] } : { items: [], whole: [] }),
    keyOf: interventionKey,
    scopeOf: projectOf,
    onNew: items => void announced.push(items.map(i => i.number!)),
  })
  try {
    await watcher.poll() // empty because unreachable — earns no baseline
    reachable = true
    await watcher.poll() // the first real read: two pre-existing PRs, and neither is news
    assert.deepEqual(announced, [])
  } finally {
    watcher.stop()
  }
})

test('one unreadable project neither floods nor silences the others (#1623)', async () => {
  const projects = async (): Promise<ProjectSummary[]> => [
    { id: 'a', path: '/a', name: 'a', activated: true },
    { id: 'b', path: '/b', name: 'b', activated: true },
  ]
  // `a` answers from the start; `b` — a repo with no remote, say — only later.
  let bReadable = false
  const announced: number[][] = []
  const watcher = startKeyedWatcher({
    projects,
    build: async () =>
      bReadable
        ? { items: [pr(1, 'u1', 'a'), pr(2, 'u2', 'b')], whole: ['a', 'b'] }
        : { items: [pr(1, 'u1', 'a')], whole: ['a'] },
    keyOf: interventionKey,
    scopeOf: projectOf,
    onNew: items => void announced.push(items.map(i => i.number!)),
  })
  try {
    await watcher.poll() // baseline for `a` only
    // `a` keeps working while `b` is unreadable — the point of holding the baseline per project.
    await watcher.poll()
    assert.deepEqual(announced, [])
    bReadable = true
    await watcher.poll() // `b`'s pre-existing PR is not news either: this is `b`'s first whole read
    assert.deepEqual(announced, [])
  } finally {
    watcher.stop()
  }
})

test('a project that is readable keeps announcing while another one cannot be read (#1623)', async () => {
  const projects = async (): Promise<ProjectSummary[]> => [
    { id: 'a', path: '/a', name: 'a', activated: true },
    { id: 'b', path: '/b', name: 'b', activated: true },
  ]
  let aItems = [pr(1, 'u1', 'a')]
  const announced: number[][] = []
  const watcher = startKeyedWatcher({
    projects,
    build: async () => ({ items: aItems, whole: ['a'] }), // `b` never answers
    keyOf: interventionKey,
    scopeOf: projectOf,
    onNew: items => void announced.push(items.map(i => i.number!)),
  })
  try {
    await watcher.poll()
    aItems = [pr(1, 'u1', 'a'), pr(3, 'u3', 'a')]
    await watcher.poll()
    assert.deepEqual(announced, [[3]])
  } finally {
    watcher.stop()
  }
})
