import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { DEFAULT_WHAT, definePreset } from './preset-prompt.js'
import { presetFilePath } from './preset-registry.js'

const preset = definePreset({ name: 'demo', template: 'Work on ${{ tf.params.what }}.', what: 'What to work on', label: 'demo' })

test('the default is a template, not a literal, so it can read the session (#874)', () => {
  // The regression this guards: a `${{ }}` inside the default used to reach the prompt verbatim,
  // because the default was the one string never passed through the evaluator.
  assert.match(DEFAULT_WHAT, /^\$\{\{/)
  assert.equal(preset.params[0]!.default, DEFAULT_WHAT)
  assert.equal(preset.render().includes('${{'), false)
})

test('the default resolves to the session name when there is one, else the whole codebase (#874)', () => {
  assert.equal(preset.render(), 'Work on entire codebase.')
  assert.equal(preset.render(undefined, {}), 'Work on entire codebase.')
  assert.equal(preset.render(undefined, { session_name: 'fix-login' }), 'Work on fix-login.')
  // An explicit target still wins, and is trimmed; a blank one still falls back.
  assert.equal(preset.render('  the API  ', { session_name: 'fix-login' }), 'Work on the API.')
  assert.equal(preset.render('   ', { session_name: 'fix-login' }), 'Work on fix-login.')
})
