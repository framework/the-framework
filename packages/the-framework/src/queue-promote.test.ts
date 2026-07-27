import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { claimedQueueEntries, entriesRetiredByPatch, promoteQueue, landPinnedEntry } from './queue-promote.js'
import type { GitRunner } from './project.js'

// Pins the retry contract auto PM acts on: the callee flags the one retryable skip, so the
// daemon never has to string-match the prose reason (which a copyedit would silently break).

test('a dirty queue file is the one retryable skip (#852/#855)', async () => {
  const git: GitRunner = async args => {
    if (args[0] === 'show' && String(args[1]).startsWith('work:')) return '- queue entry\n'
    if (args[0] === 'show') return '- older entry\n'
    if (args[0] === 'status') return ' M TODO_AGENTS.md\n'
    throw new Error(`unexpected git ${args.join(' ')}`)
  }
  const outcome = await promoteQueue('/repo', { id: 'r1', branch: 'work' }, git)
  assert.deepEqual(outcome, { promoted: false, reason: 'the checkout has uncommitted queue changes', retry: true })
})

test('a run with no branch, or no queue file on it, is a final skip (no retry flag)', async () => {
  const noBranch = await promoteQueue('/repo', { id: 'r1' })
  assert.equal(noBranch.promoted, false)
  assert.ok(!('retry' in noBranch && noBranch.retry), 'no branch is final')

  const git: GitRunner = async args => {
    if (args[0] === 'show') throw new Error('path does not exist')
    throw new Error(`unexpected git ${args.join(' ')}`)
  }
  const noFile = await promoteQueue('/repo', { id: 'r1', branch: 'work' }, git)
  assert.equal(noFile.promoted, false)
  assert.ok(!('retry' in noFile && noFile.retry), 'no queue file is final')
})

// #1204: a drain pinned to one entry lands that entry, not its whole view of the queue. The
// property that matters is that it is additive — it only ever ticks a box or appends a line — so
// two drains landing in either order compose instead of reverting each other.

const BASE = ['## Priority 7', '', '- [ ] entry a', '- [ ] entry b', ''].join('\n')

test('landPinnedEntry retires its own entry and leaves the rest alone (#1204)', () => {
  const out = landPinnedEntry(BASE, BASE, 'entry a', BASE)
  assert.match(out, /- \[x\] entry a/)
  assert.match(out, /- \[ \] entry b/)
  assert.match(out, /## Priority 7/)
})

test('two concurrent drains compose whichever order they land in (#1204)', () => {
  // The bug this exists for: run A retires entry a, run B forked before that and still shows it
  // open. A wholesale copy of B's file would un-check entry a and send an agent to redo it.
  const afterA = landPinnedEntry(BASE, BASE, 'entry a', BASE)
  const afterBoth = landPinnedEntry(afterA, BASE, 'entry b', BASE)
  assert.match(afterBoth, /- \[x\] entry a/, "the earlier run's check-off survives")
  assert.match(afterBoth, /- \[x\] entry b/)
})

test('landPinnedEntry never resurrects an entry another run already retired (#1204)', () => {
  // The run's branch still shows entry a open, because it forked before the other run landed.
  // Absence, not openness, is what marks a follow-up, so the stale open line is not re-added.
  const checkout = ['- [x] entry a', '- [ ] entry b', ''].join('\n')
  const out = landPinnedEntry(checkout, BASE, 'entry b', BASE)
  assert.equal(out.match(/entry a/g)?.length, 1)
  assert.match(out, /- \[x\] entry a/)
})

test('landPinnedEntry keeps the follow-ups the run queued (#1204)', () => {
  const branch = [BASE, '- [ ] a follow-up the run found', ''].join('\n')
  const out = landPinnedEntry(BASE, branch, 'entry a', BASE)
  assert.match(out, /- \[x\] entry a/)
  assert.match(out, /- \[ \] a follow-up the run found/)
})

test('landPinnedEntry leaves prose and an already-retired entry untouched (#1204)', () => {
  const checkout = ['# The queue', '', 'Some prose about it.', '', '- [x] entry a', ''].join('\n')
  assert.equal(landPinnedEntry(checkout, checkout, 'entry a', checkout), checkout)
  // An entry that is simply not there is not invented either.
  assert.equal(landPinnedEntry(checkout, checkout, 'never queued', checkout), checkout)
})

test('a pinned run lands only its entry, and commits just the queue file (#1204)', async () => {
  const calls: string[][] = []
  const written: string[] = []
  const git: GitRunner = async args => {
    calls.push(args)
    if (args[0] === 'merge-base') return 'abc123\n'
    if (args[0] === 'show' && String(args[1]).startsWith('work:')) return BASE
    if (args[0] === 'show' && String(args[1]).startsWith('abc123:')) return BASE
    if (args[0] === 'show') return ['## Priority 7', '', '- [ ] entry a', '- [x] entry b', ''].join('\n')
    if (args[0] === 'status') return ''
    return ''
  }
  const outcome = await promoteQueue('/repo', { id: 'r1', branch: 'work', entry: 'entry a' }, git, async (_p, c) => {
    written.push(c)
  })
  assert.deepEqual(outcome, { promoted: true, branch: 'work' })
  // The other run's retired entry b is still retired: the run's own stale copy did not land.
  assert.match(written[0]!, /- \[x\] entry a/)
  assert.match(written[0]!, /- \[x\] entry b/)
  assert.ok(!calls.some(args => args[0] === 'checkout'), 'a pinned run does not copy the branch file wholesale')
  assert.ok(calls.some(args => args[0] === 'commit' && args.includes('TODO_AGENTS.md')))
})

test('a pinned run whose entry is already retired lands nothing (#1204)', async () => {
  // Someone struck it off while the run worked. There is nothing left to do, and nothing on the
  // branch that the fork point did not already have, so no empty commit is written.
  const done = ['## Priority 7', '', '- [x] entry a', '- [ ] entry b', ''].join('\n')
  const git: GitRunner = async args => {
    if (args[0] === 'merge-base') return 'abc123\n'
    if (args[0] === 'show' && String(args[1]).startsWith('work:')) return BASE
    if (args[0] === 'show' && String(args[1]).startsWith('abc123:')) return BASE
    if (args[0] === 'show') return done
    if (args[0] === 'status') return ''
    return ''
  }
  const outcome = await promoteQueue('/repo', { id: 'r1', branch: 'work', entry: 'entry a' }, git, async () => {})
  assert.equal(outcome.promoted, false)
})

test('an entry removed by hand while the run worked is not resurrected (#1204)', () => {
  // `todo_format.md` makes removal the ordinary way to retire an entry, so "on the branch, absent
  // here" cannot mean "the run added it". Without the fork point this re-queued struck-off work.
  const checkout = ['## Priority 7', '', '- [ ] entry a', ''].join('\n')
  const out = landPinnedEntry(checkout, BASE, 'entry a', BASE)
  assert.doesNotMatch(out, /entry b/)
  assert.match(out, /- \[x\] entry a/)
})

test('claimedQueueEntries: live and open-PR runs hold their entries, abandoned ones release them (#1253)', async () => {
  const runs = [
    { id: 'r1', status: 'running', queueEntry: 'entry a' },
    { id: 'r2', status: 'done', queueEntry: 'entry b' }, // PR open: the web hand-off case
    { id: 'r3', status: 'done', queueEntry: 'entry c' }, // PR closed unmerged: abandoned
    { id: 'r4', status: 'failed', queueEntry: 'entry d' },
    { id: 'r5', status: 'done', queueEntry: 'entry e' }, // no PR at all
    { id: 'r6', status: 'done' }, // never pinned
  ]
  const claimed = await claimedQueueEntries('/repo', ['entry a', 'entry b', 'entry c', 'entry d', 'entry e'], {
    runs: async () => runs,
    pr: async (_path, run) => {
      if (run.id === 'r2') return { value: { state: 'OPEN' }, pending: false }
      if (run.id === 'r3') return { value: { state: 'CLOSED' }, pending: false }
      return { value: undefined, pending: false }
    },
  })
  assert.deepEqual(claimed.sort(), ['entry a', 'entry b'])
})

test('claimedQueueEntries: a PR lookup still warming counts as claimed, and only candidates are asked about (#1253)', async () => {
  const asked: string[] = []
  const claimed = await claimedQueueEntries('/repo', ['entry a'], {
    runs: async () => [
      { id: 'r1', status: 'done', queueEntry: 'entry a' },
      { id: 'r2', status: 'done', queueEntry: 'entry z' }, // not a candidate: never looked up
    ],
    pr: async (_path, run) => {
      asked.push(run.id)
      return { value: undefined, pending: true }
    },
  })
  assert.deepEqual(claimed, ['entry a'], 'slow answer = claimed, never handed out on a guess')
  assert.deepEqual(asked, ['r1'])
})

test('claimedQueueEntries: an unreadable run list claims nothing rather than stalling the sweep (#1253)', async () => {
  const claimed = await claimedQueueEntries('/repo', ['entry a'], {
    runs: async () => {
      throw new Error('no store')
    },
    pr: async () => ({ value: undefined, pending: false }),
  })
  assert.deepEqual(claimed, [])
})

// #1313: claims must not stop at this machine's run metas. Another daemon's drain — or a cloud
// session — shows up only as an open PR whose queue diff retires the entry.

test('entriesRetiredByPatch: a check-off and a removal both retire, an early fork point cannot (#1313)', () => {
  const patch = [
    '@@ -1,4 +1,4 @@',
    ' ## Priority 8',
    '-- [ ] entry a',
    '+- [x] entry a',
    '-- [ ] entry b',
    ' - [ ] entry c',
  ].join('\n')
  assert.deepEqual(entriesRetiredByPatch(patch, ['entry a', 'entry b', 'entry c', 'entry d']), ['entry a', 'entry b'])
  // entry d is simply not in the diff — absent on the branch means nothing here, by construction.
})

test('entriesRetiredByPatch: a remove-and-re-add-open shuffle is not a retirement (#1313)', () => {
  const patch = ['@@ -1,2 +1,2 @@', '-- [ ] entry a', '+- [ ] entry a', '+- [x] entry b'].join('\n')
  assert.deepEqual(entriesRetiredByPatch(patch, ['entry a', 'entry b']), ['entry b'])
})

test('entriesRetiredByPatch: link-bullet entries with no checkbox count as open when removed (#1313)', () => {
  // The #1164 queue style: a plain link bullet is an open entry (#1297 pinned both parsers to that).
  const patch = ['@@ -1,1 +0,0 @@', '-- [Fix the thing](tickets/2026-01-01_thing.md) — details'].join('\n')
  assert.deepEqual(entriesRetiredByPatch(patch, ['[Fix the thing](tickets/2026-01-01_thing.md) — details']), [
    '[Fix the thing](tickets/2026-01-01_thing.md) — details',
  ])
})

test('claimedQueueEntries: an open PR from another machine claims its entry (#1313)', async () => {
  const claimed = await claimedQueueEntries('/repo', ['entry a', 'entry b'], {
    runs: async () => [], // nothing local: the drain ran elsewhere
    pr: async () => ({ value: undefined, pending: false }),
    queuePatches: async () => ({ value: [{ patch: '@@ -1 +1 @@\n-- [ ] entry a\n+- [x] entry a' }], pending: false }),
  })
  assert.deepEqual(claimed, ['entry a'])
})

test('claimedQueueEntries: warming queue diffs claim everything for one tick, and a failing lookup none (#1313)', async () => {
  const warming = await claimedQueueEntries('/repo', ['entry a', 'entry b'], {
    runs: async () => [],
    pr: async () => ({ value: undefined, pending: false }),
    queuePatches: async () => ({ value: undefined, pending: true }),
  })
  assert.deepEqual(warming.sort(), ['entry a', 'entry b'], 'slow answer = stand down, never double-assign')

  const failing = await claimedQueueEntries('/repo', ['entry a'], {
    runs: async () => [],
    pr: async () => ({ value: undefined, pending: false }),
    queuePatches: async () => {
      throw new Error('gh unavailable')
    },
  })
  assert.deepEqual(failing, [], 'no gh = local-only claims, as before')
})

test('claimedQueueEntries: local claims and PR-diff claims combine (#1313)', async () => {
  const claimed = await claimedQueueEntries('/repo', ['entry a', 'entry b', 'entry c'], {
    runs: async () => [{ id: 'r1', status: 'running', queueEntry: 'entry a' }],
    pr: async () => ({ value: undefined, pending: false }),
    queuePatches: async () => ({ value: [{ patch: '@@ -1 +0,0 @@\n-- [ ] entry b' }], pending: false }),
  })
  assert.deepEqual(claimed.sort(), ['entry a', 'entry b'])
})

test('claimedQueueEntries: everything already claimed locally skips the remote read (#1313)', async () => {
  let asked = 0
  const claimed = await claimedQueueEntries('/repo', ['entry a'], {
    runs: async () => [{ id: 'r1', status: 'running', queueEntry: 'entry a' }],
    pr: async () => ({ value: undefined, pending: false }),
    queuePatches: async () => {
      asked++
      return { value: [], pending: false }
    },
  })
  assert.deepEqual(claimed, ['entry a'])
  assert.equal(asked, 0, 'a fully-claimed queue costs no gh read')
})
