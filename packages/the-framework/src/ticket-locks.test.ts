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
  abandonedReleaseMessage,
  type TicketLockDeps,
} from './ticket-locks.js'
import type { DataWriteResult, withDataBranch } from './data-branch.js'

const CWD = '/repo'
/** Where the funnel's op runs: the data branch's checkout (#1582). */
const DATA = join(CWD, '.the-framework', 'branches', 'the-framework_data')

/**
 * An in-memory data checkout behind a fake write funnel: the op runs against a file map, the
 * outcome is scripted. `runs: 2` re-runs the op, the way the real funnel does when a push loses a
 * race and the cycle re-applies the intent against origin's fresher state. A cycle that failed
 * whole restores the map, like the real funnel resets the checkout.
 */
function checkout(
  files: Record<string, string> = {},
  opts: { result?: (changed: boolean) => DataWriteResult; runs?: number } = {},
) {
  const disk = new Map(Object.entries(files).map(([file, md]) => [join(DATA, file), md]))
  const logs: string[] = []
  const messages: string[] = []
  const funnel: typeof withDataBranch = async (_cwd, message, op) => {
    const before = new Map(disk)
    for (let i = 0; i < (opts.runs ?? 1); i++) await op(DATA)
    const changed = disk.size !== before.size || [...disk].some(([key, value]) => before.get(key) !== value)
    const result = opts.result?.(changed) ?? { ok: true, changed, pushed: true }
    if (changed && (result.ok || result.committed)) messages.push(typeof message === 'function' ? message() : message)
    if (!result.ok && !result.committed) {
      disk.clear()
      for (const [key, value] of before) disk.set(key, value)
    }
    return result
  }
  const deps: TicketLockDeps = {
    funnel,
    write: async (path, content) => void disk.set(path, content),
    read: async path => {
      const md = disk.get(path)
      if (md === undefined) throw new Error('ENOENT')
      return md
    },
    remove: async path => void disk.delete(path),
    log: message => logs.push(message),
  }
  return { disk, logs, messages, deps }
}

test('acquireTicketLocks writes one .lock.md per ticket through the funnel, message counts the batch (#1420/#1582)', async () => {
  const { disk, messages, deps } = checkout({ 'tickets/a.md': '# a', 'tickets/b.md': '# b' })
  const locked = await acquireTicketLocks(
    CWD,
    [
      { ticket: 'a.md', agentId: 'plan-1-0' },
      { ticket: 'b.md', agentId: 'plan-1-1' },
    ],
    deps,
  )
  assert.deepEqual(locked.map(a => a.ticket), ['a.md', 'b.md'])
  assert.equal(disk.get(join(DATA, 'tickets/a.lock.md')), 'CLAIMED: plan-1-0\n')
  assert.equal(disk.get(join(DATA, 'tickets/b.lock.md')), 'CLAIMED: plan-1-1\n')
  assert.deepEqual(messages, [lockMessage(2)])
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
  assert.equal(disk.get(join(DATA, 'tickets/a.lock.md')), 'CLAIMED: someone-else')
  assert.equal(disk.has(join(DATA, 'tickets/b.lock.md')), false, 'the planned ticket gains no lock')
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
  assert.equal(disk.get(join(DATA, 'tickets/a.lock.md')), 'CLAIMED: someone-else')
  assert.equal(disk.get(join(DATA, 'tickets/b.lock.md')), 'CLAIMED: drain-1-1\n')
})

test('a batch whose cycle could not land resolves [] (#1420/#1582)', async () => {
  // The claim is the committed state; a cycle that failed whole claimed nothing, and the funnel
  // already restored the checkout.
  const { disk, deps } = checkout(
    { 'tickets/a.md': '# a' },
    { result: () => ({ ok: false, committed: false, error: 'index.lock held' }) },
  )
  const locked = await acquireTicketLocks(CWD, [{ ticket: 'a.md', agentId: 'x-0' }], deps)
  assert.deepEqual(locked, [])
  assert.equal(disk.has(join(DATA, 'tickets/a.lock.md')), false)
})

test('a batch that committed but could not push is kept, and the gap is logged (#1320/#1582)', async () => {
  // The commit still guards every agent forked from this machine; standing the fan-out down over
  // a network blip would cost more than the cross-machine window it briefly leaves open.
  const { logs, deps } = checkout(
    { 'tickets/a.md': '# a' },
    { result: () => ({ ok: false, committed: true, error: 'network down' }) },
  )
  const locked = await acquireTicketLocks(CWD, [{ ticket: 'a.md', agentId: 'x-0' }], deps)
  assert.deepEqual(locked.map(a => a.ticket), ['a.md'])
  assert.ok(logs.some(line => line.includes('cannot see these 1 claim(s)')))
})

test('a re-run op re-judges the batch instead of double-claiming (#1582)', async () => {
  // The funnel re-runs the op when a push loses a race. The op must be a pure function of the
  // checkout state it is handed: the locked subset is rebuilt per run, not accumulated.
  const { disk, messages, deps } = checkout({ 'tickets/a.md': '# a' }, { runs: 2 })
  const locked = await acquireTicketLocks(CWD, [{ ticket: 'a.md', agentId: 'x-0' }], deps)
  assert.deepEqual(locked.map(a => a.ticket), ['a.md'])
  assert.equal(disk.get(join(DATA, 'tickets/a.lock.md')), 'CLAIMED: x-0\n')
  // One claim, one message naming one ticket — not two.
  assert.deepEqual(messages, [lockMessage(1)])
})

test('releaseTicketLock frees the lock and says so in the commit message (#1420/#1582)', async () => {
  const { disk, messages, deps } = checkout({ 'tickets/a.lock.md': ticketLockContent('plan-1-0') })
  assert.equal(await releaseTicketLock(CWD, 'a.md', deps), 'released')
  assert.equal(disk.has(join(DATA, 'tickets/a.lock.md')), false)
  assert.deepEqual(messages, [releaseMessage('a.md')])
})

test('releaseTicketLock answers no-lock for a ticket nobody claimed (#1420)', async () => {
  const { messages, deps } = checkout({ 'tickets/a.md': '# a' })
  assert.equal(await releaseTicketLock(CWD, 'a.md', deps), 'no-lock')
  assert.deepEqual(messages, [], 'nothing committed')
})

test('a release whose cycle could not land reports error and changes nothing (#1420/#1582)', async () => {
  // The lock's protection is the committed state; the funnel restores the checkout, so the claim
  // keeps telling the truth about who holds the ticket.
  const { disk, deps } = checkout(
    { 'tickets/a.lock.md': ticketLockContent('plan-1-0') },
    { result: () => ({ ok: false, committed: false, error: 'index.lock held' }) },
  )
  assert.equal(await releaseTicketLock(CWD, 'a.md', deps), 'error')
  assert.equal(disk.get(join(DATA, 'tickets/a.lock.md')), ticketLockContent('plan-1-0'))
})

test('a release that committed but could not push stands, and says so (#1582)', async () => {
  const { disk, logs, deps } = checkout(
    { 'tickets/a.lock.md': ticketLockContent('plan-1-0') },
    { result: () => ({ ok: false, committed: true, error: 'no network' }) },
  )
  assert.equal(await releaseTicketLock(CWD, 'a.md', deps), 'released')
  assert.equal(disk.has(join(DATA, 'tickets/a.lock.md')), false)
  assert.ok(logs.some(line => /could not be pushed/.test(line)))
})

test('a heldBy release frees the exact claim the sweep minted, with its own message (#1583)', async () => {
  const { disk, messages, deps } = checkout({ 'tickets/a.lock.md': ticketLockContent('drain-1-0') })
  assert.equal(await releaseTicketLock(CWD, 'a.md', deps, { heldBy: 'drain-1-0' }), 'released')
  assert.equal(disk.has(join(DATA, 'tickets/a.lock.md')), false)
  assert.deepEqual(messages, [abandonedReleaseMessage('a.md')])
})

test('a heldBy release leaves a lock naming anyone else alone (#1583)', async () => {
  // A different holder is someone's live claim — the ticket was released by hand and re-claimed,
  // say — and outranks this cleanup: only the claim this daemon minted is its to free.
  const { disk, messages, deps } = checkout({ 'tickets/a.lock.md': ticketLockContent('someone-else') })
  assert.equal(await releaseTicketLock(CWD, 'a.md', deps, { heldBy: 'drain-1-0' }), 'not-holder')
  assert.equal(disk.get(join(DATA, 'tickets/a.lock.md')), ticketLockContent('someone-else'))
  assert.deepEqual(messages, [], 'nothing committed')
})

test('a heldBy release answers no-lock when the file is already gone (#1583)', async () => {
  const { messages, deps } = checkout({ 'tickets/a.md': '# a' })
  assert.equal(await releaseTicketLock(CWD, 'a.md', deps, { heldBy: 'drain-1-0' }), 'no-lock')
  assert.deepEqual(messages, [], 'nothing to commit')
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
