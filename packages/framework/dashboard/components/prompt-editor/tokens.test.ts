import { describe, expect, test } from 'vitest'
import { TOKEN_PATTERN, specForText } from './tokens.js'

/** Every token the pattern finds in `text`, as the tokenizer walks it. */
function found(text: string): string[] {
  return [...text.matchAll(TOKEN_PATTERN)].map(m => m[0])
}

describe('recognizing a token in text', () => {
  test('tags and calls are found anywhere in free text', () => {
    expect(found('Do the work, then <AWAIT> and call showChoices() when unsure.')).toEqual(['<AWAIT>', 'showChoices()'])
  })

  // What typing recognizes and what loading recognizes have to be the same set, or a preset
  // carrying `<await>` reaches the agent as typed while typing it produces `<AWAIT>`.
  test('letter case does not decide what counts as a tag', () => {
    expect(found('<await> and <Await> and <AWAIT>')).toEqual(['<await>', '<Await>', '<AWAIT>'])
  })

  test('what is not a token', () => {
    expect(found('2 < 3 and x > y')).toEqual([])
    expect(found('<>')).toEqual([])
    expect(found('<9lives>')).toEqual([])
    expect(found('show()')).toEqual([])
  })
})

describe('normalizing a recognized token', () => {
  test('a catalogued token takes its canonical spelling, whatever the case it was written in', () => {
    expect(specForText('<await>')).toMatchObject({ kind: 'macro', label: 'AWAIT', text: '<AWAIT>' })
    expect(specForText('<AWAIT>')).toMatchObject({ text: '<AWAIT>' })
    expect(specForText('showchoices()')).toMatchObject({ kind: 'action', text: 'showChoices()' })
  })

  test('an unknown token keeps exactly what was written', () => {
    expect(specForText('<MY_TAG>')).toMatchObject({ kind: 'macro', label: 'MY_TAG', text: '<MY_TAG>' })
    expect(specForText('showSomething()')).toMatchObject({ kind: 'action', label: 'showSomething()', text: 'showSomething()' })
  })
})
