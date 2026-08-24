import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { extendPrompt } from './steps.js'

test('extendPrompt names the work and the workspace, and nothing else (#1224)', () => {
  const prompt = extendPrompt('add a settings page')
  assert.match(prompt, /add a settings page/)
  // The one thing the agent cannot infer: this codebase already exists.
  assert.match(prompt, /existing codebase/i)
  // #1224: the rules telling it how to behave are gone, not reworded.
  assert.doesNotMatch(prompt, /do NOT re-scaffold|swap its stack|smallest coherent|read the existing code first/i)
  // #1372: the set-scope ask went with the production-grade gate it existed to skip.
  assert.doesNotMatch(prompt, /set-scope/)
  // And it never tells the agent the directory might be empty — it is not (#185).
  assert.doesNotMatch(prompt, /scaffold the whole project|workspace may be empty/i)
})
