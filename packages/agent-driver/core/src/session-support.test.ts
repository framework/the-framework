import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { OUTPUT_MAX, callArgument, cutOutput } from './session-support.js'

test('an output that fits the limit is kept whole, without the blank end', () => {
  assert.equal(cutOutput('12 passed\n\n'), '12 passed')
  assert.equal(cutOutput('x'.repeat(OUTPUT_MAX)), 'x'.repeat(OUTPUT_MAX))
})

test('an output past the limit keeps its start and its end, and says how much was cut between them', () => {
  const cut = cutOutput('a'.repeat(3000) + 'b'.repeat(3000))
  assert.equal(cut, `${'a'.repeat(2000)}\n… 2000 characters cut …\n${'b'.repeat(2000)}`)
})

test('a call argument is one line cut short, and the argument whole only when the line is not all of it', () => {
  assert.deepEqual(callArgument(undefined), {})
  assert.deepEqual(callArgument('  '), {})
  assert.deepEqual(callArgument('pnpm test'), { detail: 'pnpm test' })
  assert.deepEqual(callArgument('git status\n  --short\n'), { detail: 'git status --short', whole: 'git status\n  --short' })
  assert.deepEqual(callArgument('x'.repeat(300)), { detail: 'x'.repeat(199) + '…', whole: 'x'.repeat(300) })
  // The whole argument has the size limit of an output.
  assert.equal(callArgument('y'.repeat(9000)).whole, cutOutput('y'.repeat(9000)))
})
