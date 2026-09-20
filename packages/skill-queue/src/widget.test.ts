import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { addArgs, addToQueue, alreadyQueued, entryLabel, queueLine, type CommandResult } from './widget.js'

test('entryLabel shows a leading link\'s text, opens only an absolute http(s) target, and keeps anything else whole', () => {
  assert.deepEqual(entryLabel('[Login page](tickets/2026-08-01_login-page.md) — needs the cookie first'), { text: 'Login page' })
  assert.deepEqual(entryLabel('[Upstream bug](https://github.com/x/y/issues/1)'), { text: 'Upstream bug', url: 'https://github.com/x/y/issues/1' })
  assert.deepEqual(entryLabel('  Tidy the loader  '), { text: 'Tidy the loader' })
  // A link further in is part of a sentence, not the entry's name.
  assert.deepEqual(entryLabel('Read [the spec](README.md) first'), { text: 'Read [the spec](README.md) first' })
})

test('a link is queued as a markdown link in its priority\'s section; plain text stays plain and unranked', () => {
  assert.equal(queueLine({ text: 'Login page', href: 'tickets/2026-08-01_login-page.md' }), '[Login page](tickets/2026-08-01_login-page.md)')
  assert.equal(queueLine({ text: 'Create tickets/2026-08-01_login-page.plan.md' }), 'Create tickets/2026-08-01_login-page.plan.md')
  assert.deepEqual(addArgs({ text: 'Login page', href: 'tickets/2026-08-01_login-page.md', priority: 8 }), ['add', '[Login page](tickets/2026-08-01_login-page.md)', '--priority', '8'])
  assert.deepEqual(addArgs({ text: 'Create tickets/x.plan.md', priority: 0 }), ['add', 'Create tickets/x.plan.md', '--priority', '0'])
  assert.deepEqual(addArgs({ text: 'Tidy the loader' }), ['add', 'Tidy the loader'])
})

/** A command stub: the bare command lists `open`, and every `add` is recorded and answers `ok`. */
function queueOf(open: string[], onAdd: (args: string[]) => CommandResult = () => ({ ok: true, output: { ok: true } })) {
  const seen: string[][] = []
  const run = async (args: string[]): Promise<CommandResult> => {
    if (args.length === 0) return { ok: true, output: open }
    seen.push(args)
    return onAdd(args)
  }
  return { run, seen }
}

test('addToQueue reads the open entries once, runs one add per link not yet queued in order, and stops at the first failure or refusal with its reason', async () => {
  const { run, seen } = queueOf([])
  assert.deepEqual(await addToQueue(run, [{ text: 'a', href: 'tickets/a.md', priority: 5 }, { text: 'b' }]), { ok: true })
  assert.deepEqual(seen, [['add', '[a](tickets/a.md)', '--priority', '5'], ['add', 'b']])

  const failing = queueOf([], args => (args[1] === 'b' ? { ok: false, error: 'queue took too long' } : { ok: true, output: { ok: true } }))
  assert.deepEqual(await addToQueue(failing.run, [{ text: 'a' }, { text: 'b' }, { text: 'c' }]), { ok: false, error: 'queue took too long' })
  assert.deepEqual(
    failing.seen.map(args => args[1]),
    ['a', 'b'],
    'the batch stops where it failed',
  )

  const refusing = queueOf([], () => ({ ok: true, output: { ok: false, reason: 'no-remote' } }))
  assert.deepEqual(await addToQueue(refusing.run, [{ text: 'a' }]), { ok: false, error: 'the queue refused: no-remote' })
  assert.deepEqual(await addToQueue(queueOf([], () => ({ ok: true, output: { ok: false } })).run, [{ text: 'a' }]), { ok: false, error: 'the queue refused' })
  // An empty batch reads nothing and is done; a read that cannot run stops the batch before any add.
  const untouched = queueOf([])
  assert.deepEqual(await addToQueue(untouched.run, []), { ok: true })
  assert.deepEqual(untouched.seen, [])
  assert.deepEqual(await addToQueue(async () => ({ ok: false, error: 'no remote' }), [{ text: 'a' }]), { ok: false, error: 'no remote' })
})

test('a link already on the queue is left as it is: by its target when it points somewhere, by its exact text otherwise', async () => {
  const open = ['[Login page](tickets/2026-08-01_login-page.md) — needs the cookie first', 'Create tickets/2026-08-02_b.plan.md', '  Tidy the loader  ']
  assert.equal(alreadyQueued(open, { text: 'Login page, retitled', href: 'tickets/2026-08-01_login-page.md' }), true)
  assert.equal(alreadyQueued(open, { text: 'Other', href: 'tickets/2026-08-02_b.md' }), false)
  assert.equal(alreadyQueued(open, { text: 'Create tickets/2026-08-02_b.plan.md' }), true)
  assert.equal(alreadyQueued(open, { text: 'Tidy the loader' }), true)
  assert.equal(alreadyQueued(open, { text: 'Create tickets/2026-08-01_login-page.plan.md' }), false)
  // A plain text is not matched by a link's text: the two are different lines on the queue.
  assert.equal(alreadyQueued(open, { text: 'Login page' }), false)

  const { run, seen } = queueOf(open)
  assert.deepEqual(
    await addToQueue(run, [
      { text: 'Login page', href: 'tickets/2026-08-01_login-page.md', priority: 8 },
      { text: 'Other', href: 'tickets/2026-08-02_b.md', priority: 3 },
      { text: 'Create tickets/2026-08-02_b.plan.md' },
      { text: 'Create tickets/2026-08-03_c.plan.md' },
    ]),
    { ok: true },
  )
  assert.deepEqual(seen, [['add', '[Other](tickets/2026-08-02_b.md)', '--priority', '3'], ['add', 'Create tickets/2026-08-03_c.plan.md']])
})
