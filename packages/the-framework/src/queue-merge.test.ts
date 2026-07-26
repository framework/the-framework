import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mergeQueueDocuments, parseTodoEntryLine } from './queue-merge.js'

// The shape #1204 exists for: two agents fork the same checkout, each retires its own entry, and
// the later promotion must not revert the earlier one.

test('parseTodoEntryLine reads the queue grammar one line at a time', () => {
  assert.deepEqual(parseTodoEntryLine('- [ ] fix login'), { text: 'fix login', checked: false })
  assert.deepEqual(parseTodoEntryLine('  * [x] shipped'), { text: 'shipped', checked: true })
  assert.deepEqual(parseTodoEntryLine('1. [X] also shipped'), { text: 'also shipped', checked: true })
  assert.deepEqual(parseTodoEntryLine('- a bare item'), { text: 'a bare item', checked: undefined })
  assert.equal(parseTodoEntryLine('## Priority 7'), undefined)
  assert.equal(parseTodoEntryLine('plain prose'), undefined)
  assert.equal(parseTodoEntryLine('- [ ]'), undefined)
  assert.equal(parseTodoEntryLine(''), undefined)
})

const BASE = ['## Priority 7', '', '- [ ] entry a', '- [ ] entry b', '- [ ] entry c', ''].join('\n')

test('concurrent check-offs compose instead of the later one reverting the earlier (#1204)', () => {
  // Ours: a concurrent run already landed "entry a". Theirs: this run retired "entry b" off the
  // same fork point. The wholesale copy would have re-opened "entry a"; the merge keeps both.
  const ours = BASE.replace('- [ ] entry a', '- [x] entry a')
  const theirs = BASE.replace('- [ ] entry b', '- [x] entry b')
  const merged = mergeQueueDocuments(BASE, ours, theirs)
  assert.match(merged, /- \[x\] entry a/)
  assert.match(merged, /- \[x\] entry b/)
  assert.match(merged, /- \[ \] entry c/)
})

test('entries queued on both sides survive each other (#1204)', () => {
  // Two PM runs each appended their own pick. Promoting the second used to drop the first's.
  const ours = BASE.replace('- [ ] entry c', '- [ ] entry c\n- [ ] ours queued this')
  const theirs = BASE.replace('- [ ] entry c', '- [ ] entry c\n- [ ] theirs queued this')
  const merged = mergeQueueDocuments(BASE, ours, theirs)
  assert.match(merged, /- \[ \] ours queued this/)
  assert.match(merged, /- \[ \] theirs queued this/)
})

test('an added entry keeps the priority section its run placed it under (#1204/#1164)', () => {
  // Placement is not cosmetic: the drain works the file in order, so an entry demoted to the end
  // would be worked last however its run ranked it.
  const ours = BASE.replace('- [ ] entry a', '- [x] entry a')
  const theirs = ['## Priority 9', '', '- [ ] urgent pick', '', BASE].join('\n')
  const merged = mergeQueueDocuments(BASE, ours, theirs)
  const urgent = merged.indexOf('urgent pick')
  assert.ok(urgent !== -1, 'the added entry must survive')
  assert.ok(urgent < merged.indexOf('entry b'), 'a Priority 9 pick outranks the Priority 7 section')
  assert.match(merged, /- \[x\] entry a/, "ours' own check-off stays")
})

test('an entry the run removed outright goes, a reworded one is swapped (#1204)', () => {
  const ours = BASE
  const theirs = BASE.replace('- [ ] entry b\n', '').replace('- [ ] entry c', '- [ ] entry c, but reworded')
  const merged = mergeQueueDocuments(BASE, ours, theirs)
  assert.doesNotMatch(merged, /- \[ \] entry b/)
  assert.doesNotMatch(merged, /entry c\n/)
  assert.match(merged, /- \[ \] entry c, but reworded/)
})

test('a bare item is checked off in place, keeping its marker (#1204)', () => {
  const base = '- entry a\n* entry b\n'
  const theirs = '- [x] entry a\n* entry b\n'
  const ours = '- entry a\n* entry b\n- [ ] added by ours\n'
  const merged = mergeQueueDocuments(base, ours, theirs)
  assert.match(merged, /- \[x\] entry a/)
  assert.match(merged, /\* entry b/)
  assert.match(merged, /- \[ \] added by ours/)
})

test('a run that changed nothing merges to ours exactly (#1204)', () => {
  const ours = BASE.replace('- [ ] entry a', '- [x] entry a')
  assert.equal(mergeQueueDocuments(BASE, ours, BASE), ours)
})

test("everything the run never saw — ours' prose, sections, checked history — stays verbatim (#1204)", () => {
  const ours = ['# The queue', '', 'Some prose a human wrote.', '', BASE, '- [x] long done', ''].join('\n')
  const theirs = BASE.replace('- [ ] entry a', '- [x] entry a')
  const merged = mergeQueueDocuments(BASE, ours, theirs)
  assert.match(merged, /Some prose a human wrote\./)
  assert.match(merged, /- \[x\] long done/)
  assert.match(merged, /- \[x\] entry a/)
})

test('an entry added already checked is kept, at the end, still checked (#1204)', () => {
  // A run may queue a follow-up and complete it in the same session; losing the record would
  // invite the sweep to queue it again.
  const theirs = `${BASE}- [x] did a follow-up too\n`
  const merged = mergeQueueDocuments(BASE, BASE, theirs)
  assert.match(merged, /- \[x\] did a follow-up too/)
})
