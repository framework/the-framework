import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import {
  acquireTicketLocks,
  releaseTicketLock,
  ticketLockContent,
  ticketLockHolder,
  ticketLockName,
  lockMessage,
  releaseMessage,
  type TicketLockDeps,
} from './ticket-locks.js'

const CWD = '/repo'

/** An in-memory checkout: a file map, a git-call recorder, and every seam wired to them. */
function checkout(files: Record<string, string> = {}) {
  const disk = new Map(Object.entries(files).map(([file, md]) => [join(CWD, file), md]))
  const gitCalls: string[][] = []
  const logs: string[] = []
  const deps: TicketLockDeps = {
    git: async (args, _cwd) => {
      gitCalls.push(args)
      if (args[0] === 'rev-parse') return 'main\n'
      if (args[0] === 'symbolic-ref') return 'origin/main\n'
      return ''
    },
    write: async (path, content) => void disk.set(path, content),
    read: async path => {
      const md = disk.get(path)
      if (md === undefined) throw new Error('ENOENT')
      return md
    },
    remove: async path => void disk.delete(path),
    log: message => logs.push(message),
  }
  return { disk, gitCalls, logs, deps }
}

test('acquireTicketLocks writes one .lock.md per ticket, commits once, and pushes (#1420)', async () => {
  const { disk, gitCalls, deps } = checkout({ 'tickets/a.md': '# a', 'tickets/b.md': '# b' })
  const locked = await acquireTicketLocks(
    CWD,
    [
      { ticket: 'a.md', agentId: 'plan-1-0' },
      { ticket: 'b.md', agentId: 'plan-1-1' },
    ],
    deps,
  )
  assert.deepEqual(locked.map(a => a.ticket), ['a.md', 'b.md'])
  assert.equal(disk.get(join(CWD, 'tickets/a.lock.md')), 'CLAIMED: plan-1-0\n')
  assert.equal(disk.get(join(CWD, 'tickets/b.lock.md')), 'CLAIMED: plan-1-1\n')
  // One batch commit, pathspec-scoped so nothing else staged in the checkout rides along, then
  // one push to the branch the checkout is on.
  const commits = gitCalls.filter(args => args[0] === 'commit')
  assert.equal(commits.length, 1)
  assert.equal(commits[0]![2], lockMessage(2))
  assert.ok(commits[0]!.includes('--'))
  assert.ok(commits[0]!.includes('tickets/a.lock.md'))
  const pushes = gitCalls.filter(args => args[0] === 'push')
  assert.deepEqual(pushes, [['push', 'origin', 'HEAD:main']])
})

test('acquireTicketLocks skips a ticket already locked or already planned (#1420)', async () => {
  // The existing file is someone's claim or someone's work; either outranks this batch, and the
  // lost race costs one agent rather than overwriting anything.
  const { disk, deps } = checkout({
    'tickets/a.md': '# a',
    'tickets/a.lock.md': 'CLAIMED: someone-else',
    'tickets/b.md': '# b',
    'tickets/b.plan.md': '# a real plan',
    'tickets/c.md': '# c',
  })
  const locked = await acquireTicketLocks(
    CWD,
    [
      { ticket: 'a.md', agentId: 'x-0' },
      { ticket: 'b.md', agentId: 'x-1' },
      { ticket: 'c.md', agentId: 'x-2' },
    ],
    deps,
  )
  assert.deepEqual(locked.map(a => a.ticket), ['c.md'])
  assert.equal(disk.get(join(CWD, 'tickets/a.lock.md')), 'CLAIMED: someone-else')
  assert.equal(disk.has(join(CWD, 'tickets/b.lock.md')), false, 'the planned ticket gains no lock')
})

test('a drain batch claims a planned ticket, since the plan is its input (#1420)', async () => {
  // Same fixture as above, opposite verdict on b.md: for a drain the `.plan.md` is the work it
  // came to implement, not a rival's finished work, so only an existing lock skips the ticket.
  const { disk, deps } = checkout({
    'tickets/a.md': '# a',
    'tickets/a.lock.md': 'CLAIMED: someone-else',
    'tickets/b.md': '# b',
    'tickets/b.plan.md': '# a real plan',
  })
  const locked = await acquireTicketLocks(
    CWD,
    [
      { ticket: 'a.md', agentId: 'drain-1-0' },
      { ticket: 'b.md', agentId: 'drain-1-1' },
    ],
    deps,
    'drain',
  )
  assert.deepEqual(locked.map(a => a.ticket), ['b.md'])
  assert.equal(disk.get(join(CWD, 'tickets/a.lock.md')), 'CLAIMED: someone-else')
  assert.equal(disk.get(join(CWD, 'tickets/b.lock.md')), 'CLAIMED: drain-1-1\n')
})

test('acquireTicketLocks rolls the files back when the commit fails (#1420)', async () => {
  // The claim is the commit: files that never reached one claim nothing, and left behind they
  // would be uncommitted noise in the user's checkout.
  const { disk, deps } = checkout({ 'tickets/a.md': '# a' })
  const failing: TicketLockDeps = {
    ...deps,
    git: async args => {
      if (args[0] === 'commit') throw new Error('index.lock held')
      return ''
    },
  }
  const locked = await acquireTicketLocks(CWD, [{ ticket: 'a.md', agentId: 'x-0' }], failing)
  assert.deepEqual(locked, [])
  assert.equal(disk.has(join(CWD, 'tickets/a.lock.md')), false)
})

test('acquireTicketLocks keeps the batch when only the push fails, and says so (#1420)', async () => {
  // The commit still guards every agent forked from this checkout; the push is the cross-machine
  // half (#1320), so its failure is logged rather than standing the fan-out down.
  const { logs, deps } = checkout({ 'tickets/a.md': '# a' })
  const pushless: TicketLockDeps = {
    ...deps,
    git: async (args, cwd) => {
      if (args[0] === 'push') throw new Error('no network')
      return deps.git!(args, cwd)
    },
  }
  const locked = await acquireTicketLocks(CWD, [{ ticket: 'a.md', agentId: 'x-0' }], pushless)
  assert.equal(locked.length, 1)
  assert.ok(logs.some(line => /could not be pushed/.test(line)))
})

test('ticketLockHolder reads the claim and rejects non-claims (#1420)', () => {
  assert.equal(ticketLockHolder(ticketLockContent('plan-1-0')), 'plan-1-0')
  assert.equal(ticketLockHolder('  \nCLAIMED: run-42 (my session)'), 'run-42 (my session)')
  assert.equal(ticketLockHolder('# A real plan\n\nCLAIMED elsewhere…'), undefined)
  assert.equal(ticketLockHolder('CLAIMED:'), undefined)
  assert.equal(ticketLockHolder(''), undefined)
})

test('ticketLockName maps a ticket to its lock sibling', () => {
  assert.equal(ticketLockName('2026-07-31_some-ticket.md'), '2026-07-31_some-ticket.lock.md')
})

test('releaseTicketLock deletes the lock, commits, and pushes (#1420)', async () => {
  const { disk, gitCalls, deps } = checkout({
    'tickets/a.md': '# a',
    'tickets/a.lock.md': ticketLockContent('plan-1-0'),
  })
  assert.equal(await releaseTicketLock(CWD, 'a.md', deps), 'released')
  assert.equal(disk.has(join(CWD, 'tickets/a.lock.md')), false)
  const commits = gitCalls.filter(args => args[0] === 'commit')
  assert.equal(commits.length, 1)
  assert.equal(commits[0]![2], releaseMessage('a.md'))
  assert.deepEqual(gitCalls.filter(args => args[0] === 'push'), [['push', 'origin', 'HEAD:main']])
})

test('releaseTicketLock answers no-lock for a ticket nobody claimed (#1420)', async () => {
  const { gitCalls, deps } = checkout({ 'tickets/a.md': '# a' })
  assert.equal(await releaseTicketLock(CWD, 'a.md', deps), 'no-lock')
  assert.equal(gitCalls.filter(args => args[0] === 'commit').length, 0, 'nothing to commit')
})

test('releaseTicketLock puts the file back when the commit fails (#1420)', async () => {
  // The lock's protection is the committed state; a deletion that never landed would make the
  // checkout lie about who holds the ticket.
  const { disk, deps } = checkout({
    'tickets/a.md': '# a',
    'tickets/a.lock.md': ticketLockContent('plan-1-0'),
  })
  const failing: TicketLockDeps = {
    ...deps,
    git: async args => {
      if (args[0] === 'commit') throw new Error('index.lock held')
      return ''
    },
  }
  assert.equal(await releaseTicketLock(CWD, 'a.md', failing), 'error')
  assert.equal(disk.get(join(CWD, 'tickets/a.lock.md')), ticketLockContent('plan-1-0'))
})

test('releaseTicketLock keeps the release when only the push fails, and says so (#1420)', async () => {
  const { disk, logs, deps } = checkout({
    'tickets/a.md': '# a',
    'tickets/a.lock.md': ticketLockContent('plan-1-0'),
  })
  const pushless: TicketLockDeps = {
    ...deps,
    git: async (args, cwd) => {
      if (args[0] === 'push') throw new Error('no network')
      return deps.git!(args, cwd)
    },
  }
  assert.equal(await releaseTicketLock(CWD, 'a.md', pushless), 'released')
  assert.equal(disk.has(join(CWD, 'tickets/a.lock.md')), false)
  assert.ok(logs.some(line => /could not be pushed/.test(line)))
})

test('a checkout on a feature branch keeps its lock commit local rather than pushing (#1364 review)', async () => {
  // The push exists to land locks where other machines fork from: origin's default branch.
  // From any other branch, `HEAD:main` would carry that branch's own commits onto main, and the
  // old `HEAD:<current branch>` published whatever branch the checkout happened to be on — so
  // the push is skipped, said out loud, and the commit still guards local forks.
  const { gitCalls, logs, deps } = checkout({ 'tickets/a.md': '# a' })
  const onFeature: TicketLockDeps = {
    ...deps,
    git: async (args, cwd) => {
      if (args[0] === 'rev-parse') {
        gitCalls.push(args)
        return 'my-feature\n'
      }
      return deps.git!(args, cwd)
    },
  }
  const locked = await acquireTicketLocks(CWD, [{ ticket: 'a.md', agentId: 'agent-0' }], onFeature)
  assert.equal(locked.length, 1, 'the commit still locks: only the cross-machine push is off')
  assert.equal(gitCalls.some(args => args[0] === 'push'), false)
  assert.ok(logs.some(line => /not on the default branch/.test(line)))
})
