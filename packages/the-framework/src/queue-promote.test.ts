import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { promoteQueue, landPinnedEntry } from './queue-promote.js'
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
  // The agent's branch still shows entry a open, because it forked before the other agent landed.
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

test('landPinnedEntry retires a no-checkbox open entry, not only a [ ] one (#1164/#1297)', () => {
  // Agents write plain bullets without a box; the rest of the sweep counts those as open, so
  // the pin must retire them too — otherwise the entry stays open and is re-drained forever.
  const checkout = ['## Priority 7', '', '- entry a', '- [ ] entry b', ''].join('\n')
  const out = landPinnedEntry(checkout, checkout, 'entry a', checkout)
  assert.match(out, /- \[x\] entry a/)
  assert.match(out, /- \[ \] entry b/)
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
  // The other agent's retired entry b is still retired: the agent's own stale copy did not land.
  assert.match(written[0]!, /- \[x\] entry a/)
  assert.match(written[0]!, /- \[x\] entry b/)
  assert.ok(!calls.some(args => args[0] === 'checkout'), 'a pinned run does not copy the branch file wholesale')
  assert.ok(calls.some(args => args[0] === 'commit' && args.includes('TODO_AGENTS.md')))
})

test('a pinned run whose entry is already retired lands nothing (#1204)', async () => {
  // Someone struck it off while the agent worked. There is nothing left to do, and nothing on the
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
  // here" cannot mean "the agent added it". Without the fork point this re-queued struck-off work.
  const checkout = ['## Priority 7', '', '- [ ] entry a', ''].join('\n')
  const out = landPinnedEntry(checkout, BASE, 'entry a', BASE)
  assert.doesNotMatch(out, /entry b/)
  assert.match(out, /- \[x\] entry a/)
})
