import { describe, expect, test } from 'vitest'
import { modelName } from './models.js'

describe('modelName', () => {
  const claude = { models: [{ id: 'opus', name: 'Opus 5.5' }] }

  test('a listed model is named as its agent names it', () => {
    expect(modelName(claude, 'opus')).toBe('Opus 5.5')
  })

  test('a model the agent does not list, or a list not answered yet, is named by its id', () => {
    expect(modelName(claude, 'fable')).toBe('fable')
    expect(modelName(undefined, 'opus')).toBe('opus')
    expect(modelName({ models: [], error: 'not logged in' }, 'opus')).toBe('opus')
  })
})
