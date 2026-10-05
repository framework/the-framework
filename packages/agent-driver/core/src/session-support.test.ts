import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { OUTPUT_MAX, callArgument, cutOutput, hunkLines, lineCount, patchSize } from './session-support.js'

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

test('lineCount counts a last line with no line break, and none in an empty text', () => {
  assert.equal(lineCount(''), 0)
  assert.equal(lineCount('one'), 1)
  assert.equal(lineCount('one\n'), 1)
  assert.equal(lineCount('one\ntwo\nthree'), 3)
  assert.equal(lineCount('one\n\nthree\n'), 3)
})

test('patchSize counts the lines a patch adds and removes, whatever their own text starts with, and not its context', () => {
  assert.deepEqual(patchSize([' one', '-two', '+TWO', '+two and a half', ' three', '\\ No newline at end of file']), { added: 2, removed: 1 })
  // A removed markdown rule, a removed SQL comment, an added `++i;`: each is a line of its own.
  assert.deepEqual(patchSize(['----', '--- note', '+++i;', '+---']), { added: 2, removed: 2 })
  assert.deepEqual(patchSize([]), { added: 0, removed: 0 })
})

test('hunkLines gives the lines of a unified diff from its first hunk on, without its file headers, and nothing for a text that is no diff', () => {
  assert.deepEqual(hunkLines('--- a/x.txt\n+++ b/x.txt\n@@ -1 +1 @@\n-old\n+new'), ['@@ -1 +1 @@', '-old', '+new'])
  assert.deepEqual(hunkLines('diff --git a/x b/x\nindex 1..2\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n---\n+x'), ['@@ -1 +1 @@', '---', '+x'])
  assert.deepEqual(hunkLines('@@ -0,0 +1 @@\n+a'), ['@@ -0,0 +1 @@', '+a'])
  // A file's own content, even one that holds a line like a hunk's: no diff.
  assert.equal(hunkLines('one\ntwo'), undefined)
  assert.equal(hunkLines('notes\n@@ -1 +1 @@\n+x'), undefined)
  assert.equal(hunkLines('--- only a header'), undefined)
  assert.equal(hunkLines(''), undefined)
})
