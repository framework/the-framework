import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createRunDriver } from './run-driver.js'
import { ActionsDriver, ClaudeCodeDriver, CloudDriver, CodexDriver } from './driver/index.js'

// The run-target wrapper (#1050/#610): `--run-on actions` becomes an ActionsDriver (#934),
// `--run-on web` a CloudDriver; anything else falls through to the local agent driver,
// byte-identical to before.

const ACTIONS = { owner: 'gemstack-land', repo: 'gemstack', token: 't' }

test('createRunDriver returns an ActionsDriver for target "actions"', () => {
  const driver = createRunDriver({ driver: 'claude', target: 'actions', actionsConfig: ACTIONS })
  assert.ok(driver instanceof ActionsDriver)
})

test('createRunDriver falls through to the local agent driver otherwise', () => {
  assert.ok(createRunDriver({ driver: 'claude' }) instanceof ClaudeCodeDriver)
  assert.ok(createRunDriver({ driver: 'claude', target: 'local' }) instanceof ClaudeCodeDriver)
  assert.ok(createRunDriver({ driver: 'codex', target: 'local' }) instanceof CodexDriver)
})

test('createRunDriver requires the Actions config when target is "actions"', () => {
  assert.throws(() => createRunDriver({ driver: 'claude', target: 'actions' }), /needs the repo owner/)
})

test('createRunDriver returns a CloudDriver for target "web"', () => {
  assert.ok(createRunDriver({ driver: 'claude', target: 'web' }) instanceof CloudDriver)
})

test('the web target needs no configuration: the CLI already holds the account', () => {
  assert.doesNotThrow(() => createRunDriver({ driver: 'claude', target: 'web' }))
})
