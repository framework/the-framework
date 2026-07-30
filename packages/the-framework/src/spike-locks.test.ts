import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import {
  acquireSpikeLocks,
  releaseStaleSpikeLocks,
  isSpikeLock,
  spikeLockContent,
  lockMessage,
  SPIKE_LOCK_STALE_MS,
  type SpikeLockDeps,
} from './spike-locks.js'

const CWD = '/repo'
const NOW = Date.UTC(2026, 6, 29, 12, 0, 0)

/** An in-memory checkout: a file map, a git-call recorder, and every seam wired to them. */
function checkout(files: Record<string, string> = {}) {
  const disk = new Map(Object.entries(files).map(([file, md]) => [join(CWD, file), md]))
  const gitCalls: string[][] = []
  const logs: string[] = []
  /** What `git log -1 --format=%ct -- <file>` answers, epoch seconds as git prints them. */
  const commitTimes = new Map<string, string>()
  const deps: SpikeLockDeps = {
    git: async (args, _cwd) => {
      gitCalls.push(args)
      if (args[0] === 'rev-parse') return 'main\n'
      if (args[0] === 'symbolic-ref') return 'origin/main\n'
      if (args[0] === 'log') return commitTimes.get(args[args.length - 1]!) ?? ''
      return ''
    },
    write: async (path, content) => void disk.set(path, content),
    read: async path => {
      const md = disk.get(path)
      if (md === undefined) throw new Error('ENOENT')
      return md
    },
    remove: async path => void disk.delete(path),
    list: async () => {
      const dir = `${join(CWD, 'tickets')}/`
      return [...disk.keys()].filter(path => path.startsWith(dir)).map(path => path.slice(dir.length))
    },
    prTouches: async () => false,
    now: () => NOW,
    log: message => logs.push(message),
  }
  return { disk, gitCalls, logs, commitTimes, deps }
}

test('acquireSpikeLocks writes both placeholders per ticket, commits once, and pushes (#1327)', async () => {
  const { disk, gitCalls, deps } = checkout({ 'tickets/a.md': '# a', 'tickets/b.md': '# b' })
  const locked = await acquireSpikeLocks(
    CWD,
    [
      { ticket: 'a.md', agentId: 'spike-1-0' },
      { ticket: 'b.md', agentId: 'spike-1-1' },
    ],
    deps,
  )
  assert.deepEqual(locked.map(a => a.ticket), ['a.md', 'b.md'])
  assert.equal(disk.get(join(CWD, 'tickets/a.spike.md')), 'PENDING:spike-1-0\n')
  assert.equal(disk.get(join(CWD, 'tickets/a.plan.md')), 'PENDING:spike-1-0\n')
  assert.equal(disk.get(join(CWD, 'tickets/b.spike.md')), 'PENDING:spike-1-1\n')
  // One batch commit, pathspec-scoped so nothing else staged in the checkout rides along, then
  // one push to the branch the checkout is on.
  const commits = gitCalls.filter(args => args[0] === 'commit')
  assert.equal(commits.length, 1)
  assert.equal(commits[0]![2], lockMessage(2))
  assert.ok(commits[0]!.includes('--'))
  assert.ok(commits[0]!.includes('tickets/a.spike.md'))
  const pushes = gitCalls.filter(args => args[0] === 'push')
  assert.deepEqual(pushes, [['push', 'origin', 'HEAD:main']])
})

test('acquireSpikeLocks skips a ticket whose sibling already exists, real or placeholder (#1327)', async () => {
  // The existing file is someone's claim or someone's work; either outranks this batch, and the
  // lost race costs one agent rather than overwriting anything.
  const { disk, deps } = checkout({
    'tickets/a.md': '# a',
    'tickets/a.spike.md': 'PENDING:someone-else',
    'tickets/b.md': '# b',
    'tickets/b.plan.md': '# a real plan',
    'tickets/c.md': '# c',
  })
  const locked = await acquireSpikeLocks(
    CWD,
    [
      { ticket: 'a.md', agentId: 'x-0' },
      { ticket: 'b.md', agentId: 'x-1' },
      { ticket: 'c.md', agentId: 'x-2' },
    ],
    deps,
  )
  assert.deepEqual(locked.map(a => a.ticket), ['c.md'])
  assert.equal(disk.get(join(CWD, 'tickets/a.spike.md')), 'PENDING:someone-else')
  assert.equal(disk.has(join(CWD, 'tickets/b.spike.md')), false, 'the skipped ticket gains no new sibling')
})

test('acquireSpikeLocks rolls the files back when the commit fails (#1327)', async () => {
  // The claim is the commit: files that never reached one claim nothing, and left behind they
  // would be uncommitted noise in the user's checkout.
  const { disk, deps } = checkout({ 'tickets/a.md': '# a' })
  const failing: SpikeLockDeps = {
    ...deps,
    git: async args => {
      if (args[0] === 'commit') throw new Error('index.lock held')
      return ''
    },
  }
  const locked = await acquireSpikeLocks(CWD, [{ ticket: 'a.md', agentId: 'x-0' }], failing)
  assert.deepEqual(locked, [])
  assert.equal(disk.has(join(CWD, 'tickets/a.spike.md')), false)
  assert.equal(disk.has(join(CWD, 'tickets/a.plan.md')), false)
})

test('acquireSpikeLocks keeps the batch when only the push fails, and says so (#1327)', async () => {
  // The commit still guards every run forked from this checkout; the push is the cross-machine
  // half (#1320), so its failure is logged rather than standing the fan-out down.
  const { logs, deps } = checkout({ 'tickets/a.md': '# a' })
  const pushless: SpikeLockDeps = {
    ...deps,
    git: async (args, cwd) => {
      if (args[0] === 'push') throw new Error('no network')
      return deps.git!(args, cwd)
    },
  }
  const locked = await acquireSpikeLocks(CWD, [{ ticket: 'a.md', agentId: 'x-0' }], pushless)
  assert.equal(locked.length, 1)
  assert.ok(logs.some(line => /could not be pushed/.test(line)))
})

test('isSpikeLock tells a placeholder from a real document (#1327)', () => {
  assert.equal(isSpikeLock(spikeLockContent('spike-1-0')), true)
  assert.equal(isSpikeLock('  \nPENDING:x'), true)
  assert.equal(isSpikeLock('# A real spike\n\nPENDING questions…'), false)
  assert.equal(isSpikeLock(''), false)
})

/** A checkout holding one committed lock pair, aged `ageMs` before NOW. */
function lockedCheckout(ageMs: number) {
  const fixture = checkout({
    'tickets/a.md': '# a',
    'tickets/a.spike.md': spikeLockContent('spike-1-0'),
    'tickets/a.plan.md': spikeLockContent('spike-1-0'),
  })
  const stamp = String(Math.floor((NOW - ageMs) / 1000))
  fixture.commitTimes.set('tickets/a.spike.md', stamp)
  fixture.commitTimes.set('tickets/a.plan.md', stamp)
  return fixture
}

test('releaseStaleSpikeLocks frees a lock that is old, PR-less, and still a placeholder (#1327)', async () => {
  const { disk, gitCalls, deps } = lockedCheckout(SPIKE_LOCK_STALE_MS + 60_000)
  const released = await releaseStaleSpikeLocks(CWD, deps)
  assert.deepEqual(released, ['a.md'])
  assert.equal(disk.has(join(CWD, 'tickets/a.spike.md')), false)
  assert.equal(disk.has(join(CWD, 'tickets/a.plan.md')), false)
  // The deletions land as one pathspec-scoped commit and are pushed, like the acquisition.
  assert.equal(gitCalls.filter(args => args[0] === 'commit').length, 1)
  assert.deepEqual(gitCalls.filter(args => args[0] === 'push'), [['push', 'origin', 'HEAD:main']])
})

test('releaseStaleSpikeLocks keeps a young lock (#1327)', async () => {
  const { disk, deps } = lockedCheckout(SPIKE_LOCK_STALE_MS - 60_000)
  assert.deepEqual(await releaseStaleSpikeLocks(CWD, deps), [])
  assert.equal(disk.has(join(CWD, 'tickets/a.spike.md')), true)
})

test('releaseStaleSpikeLocks keeps a lock an open PR touches: the agent finished (#1327)', async () => {
  // The PR carries the real sibling; from here the #1313 diff claim owns the window, and
  // releasing would fan the ticket out again under a finished spike.
  const { disk, deps } = lockedCheckout(SPIKE_LOCK_STALE_MS + 60_000)
  assert.deepEqual(await releaseStaleSpikeLocks(CWD, { ...deps, prTouches: async () => true }), [])
  assert.equal(disk.has(join(CWD, 'tickets/a.spike.md')), true)
})

test('releaseStaleSpikeLocks keeps a lock when the PR answer cannot be read (#1327)', async () => {
  // Releasing over a `gh` hiccup would re-open the double-work window; a dead agent's ticket
  // only waits one interval longer.
  const { disk, deps } = lockedCheckout(SPIKE_LOCK_STALE_MS + 60_000)
  assert.deepEqual(await releaseStaleSpikeLocks(CWD, { ...deps, prTouches: async () => undefined }), [])
  assert.equal(disk.has(join(CWD, 'tickets/a.spike.md')), true)
})

test('releaseStaleSpikeLocks leaves an uncommitted placeholder alone (#1327)', async () => {
  // No commit time means a batch mid-acquisition (or one its acquire already rolled back), which
  // is the opposite of stale.
  const { disk, deps } = checkout({
    'tickets/a.md': '# a',
    'tickets/a.spike.md': spikeLockContent('spike-1-0'),
    'tickets/a.plan.md': spikeLockContent('spike-1-0'),
  })
  assert.deepEqual(await releaseStaleSpikeLocks(CWD, deps), [])
  assert.equal(disk.has(join(CWD, 'tickets/a.spike.md')), true)
})

test('releaseStaleSpikeLocks never touches a real spike or plan (#1327)', async () => {
  const { disk, commitTimes, deps } = checkout({
    'tickets/a.md': '# a',
    'tickets/a.spike.md': '# A real spike, written long ago',
    'tickets/a.plan.md': spikeLockContent('spike-1-0'),
  })
  const stamp = String(Math.floor((NOW - SPIKE_LOCK_STALE_MS * 2) / 1000))
  commitTimes.set('tickets/a.spike.md', stamp)
  commitTimes.set('tickets/a.plan.md', stamp)
  const released = await releaseStaleSpikeLocks(CWD, deps)
  // The stale placeholder plan goes; the real spike beside it stays.
  assert.deepEqual(released, ['a.md'])
  assert.equal(disk.has(join(CWD, 'tickets/a.spike.md')), true)
  assert.equal(disk.has(join(CWD, 'tickets/a.plan.md')), false)
})

test('a checkout on a feature branch keeps its lock commit local rather than pushing (#1364 review)', async () => {
  // The push exists to land locks where other machines fork from: origin's default branch.
  // From any other branch, `HEAD:main` would carry that branch's own commits onto main, and the
  // old `HEAD:<current branch>` published whatever branch the checkout happened to be on — so
  // the push is skipped, said out loud, and the commit still guards local forks.
  const { gitCalls, logs, deps } = checkout({ 'tickets/a.md': '# a' })
  const onFeature: SpikeLockDeps = {
    ...deps,
    git: async (args, cwd) => {
      if (args[0] === 'rev-parse') {
        gitCalls.push(args)
        return 'my-feature\n'
      }
      return deps.git!(args, cwd)
    },
  }
  const locked = await acquireSpikeLocks(CWD, [{ ticket: 'a.md', agentId: 'agent-0' }], onFeature)
  assert.equal(locked.length, 1, 'the commit still locks: only the cross-machine push is off')
  assert.equal(gitCalls.some(args => args[0] === 'push'), false)
  assert.ok(logs.some(line => /not on the default branch/.test(line)))
})
