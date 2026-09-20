import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { addArgs, addToQueue, entryLabel, queueLine, type CommandResult } from './widget.js'

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

test('addToQueue runs one add per link in order, and stops at the first failure or refusal with its reason', async () => {
  const seen: string[][] = []
  const ok = async (args: string[]): Promise<CommandResult> => {
    seen.push(args)
    return { ok: true, output: { ok: true, entry: args[1] } }
  }
  assert.deepEqual(await addToQueue(ok, [{ text: 'a', href: 'tickets/a.md', priority: 5 }, { text: 'b' }]), { ok: true })
  assert.deepEqual(seen, [['add', '[a](tickets/a.md)', '--priority', '5'], ['add', 'b']])

  const failing = async (args: string[]): Promise<CommandResult> => (args[1] === 'b' ? { ok: false, error: 'queue took too long' } : { ok: true, output: { ok: true } })
  const ran: string[] = []
  assert.deepEqual(
    await addToQueue(
      async args => {
        ran.push(args[1]!)
        return failing(args)
      },
      [{ text: 'a' }, { text: 'b' }, { text: 'c' }],
    ),
    { ok: false, error: 'queue took too long' },
  )
  assert.deepEqual(ran, ['a', 'b'], 'the batch stops where it failed')

  const refusing = async (): Promise<CommandResult> => ({ ok: true, output: { ok: false, reason: 'no-remote' } })
  assert.deepEqual(await addToQueue(refusing, [{ text: 'a' }]), { ok: false, error: 'the queue refused: no-remote' })
  assert.deepEqual(await addToQueue(async () => ({ ok: true, output: { ok: false } }), [{ text: 'a' }]), { ok: false, error: 'the queue refused' })
  assert.deepEqual(await addToQueue(ok, []), { ok: true })
})
