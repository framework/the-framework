import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { defuseClosingKeywords } from './closing-keywords.js'

// #1567: a plan PR whose body ended "…then comment on and close #1164" closed #1164 on merge,
// and the next tickets sync then removed the ticket and its fresh plan. The words stay and the
// reference stays live; only GitHub's reading of them changes.
describe('defuseClosingKeywords', () => {
  test('the phrase that closed #1164 keeps its words and loses its effect', () => {
    const before = 'The plan proposes: expose `queued` on the single-ticket read — then comment on and close #1164.'
    assert.equal(
      defuseClosingKeywords(before),
      'The plan proposes: expose `queued` on the single-ticket read — then comment on and close the ticket #1164.',
    )
  })

  test('every keyword form GitHub accepts is defused, whatever the case', () => {
    for (const keyword of ['close', 'closes', 'closed', 'fix', 'fixes', 'fixed', 'resolve', 'resolves', 'resolved']) {
      assert.equal(defuseClosingKeywords(`this ${keyword} #42`), `this ${keyword} the ticket #42`, keyword)
      const upper = keyword.toUpperCase()
      assert.equal(defuseClosingKeywords(`this ${upper} #42`), `this ${upper} the ticket #42`, keyword)
    }
  })

  test('the reference itself is never rewritten, so it stays clickable and cross-references', () => {
    // Rom's point on #1612: backticking the reference defused the phrase but also killed the
    // link and the mention on the issue's own timeline. Only the adjacency may be broken.
    assert.equal(defuseClosingKeywords('close #1164').includes('`'), false)
    assert.match(defuseClosingKeywords('close #1164'), /(^|\s)#1164\b/)
  })

  test('the cross-repo form closes just as well, so it is defused too', () => {
    assert.equal(
      defuseClosingKeywords('fixes gemstack-land/the-framework#7'),
      'fixes the ticket gemstack-land/the-framework#7',
    )
  })

  test('an issue mentioned without a keyword is left alone — a reference is not a command', () => {
    const text = 'See #1164 for the symptom, and the evidence table on #1334.'
    assert.equal(defuseClosingKeywords(text), text)
  })

  test('a word that merely ends in a keyword is not one', () => {
    const text = 'the enclose #42 case'
    assert.equal(defuseClosingKeywords(text), text)
  })

  test('a reference already inside backticks is a code sample, not a command', () => {
    const text = 'write `close #42` to close it'
    assert.equal(defuseClosingKeywords(text), text)
  })

  test('running it twice changes nothing the second time', () => {
    const once = defuseClosingKeywords('fixes #9 and closes #10')
    assert.equal(defuseClosingKeywords(once), once)
    assert.equal(once, 'fixes the ticket #9 and closes the ticket #10')
  })
})
