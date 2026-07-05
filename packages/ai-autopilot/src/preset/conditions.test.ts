import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { selectWinners, stemOf, readConditions } from './conditions.js'

describe('stemOf', () => {
  it('takes the name up to the first dot', () => {
    assert.equal(stemOf('loop.md'), 'loop')
    assert.equal(stemOf('loop.autopilot.md'), 'loop')
    assert.equal(stemOf('major-change.md'), 'major-change') // hyphens are not separators
    assert.equal(stemOf('review.technical.md'), 'review')
  })
})

describe('readConditions', () => {
  it('normalizes a string, a list, or nothing', () => {
    assert.deepEqual(readConditions({ conditions: 'autopilot' }), ['autopilot'])
    assert.deepEqual(readConditions({ conditions: ['autopilot', 'technical'] }), ['autopilot', 'technical'])
    assert.deepEqual(readConditions({}), [])
    assert.deepEqual(readConditions(undefined), [])
  })
})

describe('selectWinners', () => {
  const base = { stem: 'loop', conditions: [] }
  const autopilot = { stem: 'loop', conditions: ['autopilot'] }
  const technical = { stem: 'loop', conditions: ['technical'] }

  it('picks the base when no mode is active', () => {
    assert.deepEqual(selectWinners([base, autopilot], []), [base])
  })

  it('an active-mode variant beats the base', () => {
    assert.deepEqual(selectWinners([base, autopilot], ['autopilot']), [autopilot])
  })

  it('a variant whose mode is not active is ineligible; base falls back', () => {
    assert.deepEqual(selectWinners([base, autopilot], ['technical']), [base])
  })

  it('keeps a variant even when there is no base', () => {
    assert.deepEqual(selectWinners([autopilot], ['autopilot']), [autopilot])
    assert.deepEqual(selectWinners([autopilot], []), []) // nothing eligible
  })

  it('the most specific eligible variant wins', () => {
    const both = { stem: 'loop', conditions: ['autopilot', 'technical'] }
    assert.deepEqual(selectWinners([base, autopilot, both], ['autopilot', 'technical']), [both])
  })

  it('resolves each stem independently', () => {
    const winners = selectWinners([base, technical, { stem: 'prompt', conditions: [] }], ['technical'])
    assert.deepEqual(winners.map(w => w.stem).sort(), ['loop', 'prompt'])
    assert.equal(winners.find(w => w.stem === 'loop'), technical)
  })
})
