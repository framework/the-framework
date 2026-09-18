import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { pickedIds } from './events.js'
import { formatFrameworkEvent } from './terminal.js'

test('pickedIds normalizes a single id or a subset to a list (#332)', () => {
  assert.deepEqual(pickedIds('proceed'), ['proceed'])
  assert.deepEqual(pickedIds(['p0', 'p2']), ['p0', 'p2'])
  assert.deepEqual(pickedIds([]), [])
  assert.deepEqual(pickedIds(''), [])
})

test('formatFrameworkEvent renders a multi-select choice as a checklist (#332)', () => {
  const line = formatFrameworkEvent({
    kind: 'choice',
    id: 'ms',
    title: 'Pick problems to deep-dive',
    multi: true,
    options: [
      { id: 'p0', label: 'auth flow', default: true },
      { id: 'p1', label: 'routing' },
    ],
  })
  assert.equal(line, '? Pick problems to deep-dive\n    [x] auth flow\n    [ ] routing')
})

test('formatFrameworkEvent renders a single-select choice with the recommended mark (#304)', () => {
  const line = formatFrameworkEvent({
    kind: 'choice',
    id: 'plan',
    title: 'Approve this plan?',
    recommended: 'proceed',
    options: [
      { id: 'proceed', label: 'Proceed: Vike' },
      { id: 'alt:0', label: 'Use Next.js instead' },
    ],
  })
  assert.equal(line, '? Approve this plan?\n    ● Proceed: Vike\n    ○ Use Next.js instead')
})

test('formatFrameworkEvent renders a session-update line', () => {
  assert.equal(formatFrameworkEvent({ kind: 'session-update', sessionId: 'abc123' }), '  session abc123')
  assert.equal(
    formatFrameworkEvent({ kind: 'session-update', sessionId: 'abc123', sessionLink: 'https://x.dev/s/abc123' }),
    '  session abc123 — https://x.dev/s/abc123',
  )
})

test('formatFrameworkEvent shows a preview of the driver prompt, not just "prompt sent" (#476)', () => {
  assert.equal(
    formatFrameworkEvent({ kind: 'driver', event: { type: 'start', prompt: 'Build this app end to end' } }),
    '  › prompt: Build this app end to end',
  )
  // Long prompts are truncated for the one-line feed (the dashboard shows the full text).
  const long = 'x'.repeat(300)
  const line = formatFrameworkEvent({ kind: 'driver', event: { type: 'start', prompt: long } })!
  assert.ok(line.startsWith('  › prompt: '))
  assert.ok(line.length < 160 && line.endsWith('…'))
})

test('formatFrameworkEvent distinguishes finished / stopped / failed (#218)', () => {
  assert.equal(formatFrameworkEvent({ kind: 'end', ok: true }), '✓ finished')
  assert.equal(formatFrameworkEvent({ kind: 'end', ok: false, stopped: true }), '■ stopped')
  assert.equal(formatFrameworkEvent({ kind: 'end', ok: false, detail: 'boom' }), '✗ failed: boom')
})

test('formatFrameworkEvent renders a usage spend line (#322)', () => {
  const base = { kind: 'usage' as const, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }
  assert.equal(formatFrameworkEvent({ ...base, costUsd: 0.04, turns: 2 }), '  spend: $0.0400 over 2 turns')
  assert.equal(formatFrameworkEvent({ ...base, costUsd: 0.02, turns: 1 }), '  spend: $0.0200 over 1 turn')
})

test('formatFrameworkEvent reports tokens when the agent reported no price (#540)', () => {
  // Codex's shape. A `$0.0000` spend line would read as free rather than unknown.
  const line = formatFrameworkEvent({
    kind: 'usage',
    inputTokens: 186,
    outputTokens: 6,
    cacheReadTokens: 12032,
    cacheCreationTokens: 0,
    turns: 1,
  })
  assert.equal(line, '  tokens: 12,224 (6 out) over 1 turn — no price reported')
  assert.doesNotMatch(line!, /\$/)
})

test('formats the rate-limit line by how much the quota actually matters (#517)', () => {
  const at = Date.UTC(2026, 6, 15, 4, 30)
  const line = (status: string) => formatFrameworkEvent({ kind: 'driver', event: { type: 'rate-limit', limit: { status, window: 'five_hour', resetsAt: at } } })!
  assert.match(line('allowed'), /^\s+· quota allowed \(five_hour\)/)
  assert.match(line('allowed_warning'), /^\s+! quota running low \(five_hour\)/)
  assert.match(line('rejected'), /^\s+✗ quota exhausted \(five_hour\)/)
  // An unseen status still renders rather than blowing up or vanishing.
  assert.match(line('some_new_status'), /quota some_new_status/)
  assert.ok(line('allowed').includes(new Date(at).toISOString()))
})

