import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createTargetDriver } from './target-driver.js'
import { ActionsDriver, ClaudeCodeDriver, CodexDriver } from 'agent-driver'
import { CloudDriver } from './driver/cloud.js'

// The run-target wrapper (#1050/#610): `--run-on actions` becomes an ActionsDriver (#934),
// `--run-on web` a CloudDriver; anything else falls through to the driver for the chosen CLI,
// byte-identical to before.

const ACTIONS = { owner: 'gemstack-land', repo: 'gemstack', token: 't' }

test('createTargetDriver returns an ActionsDriver for target "actions"', () => {
  const driver = createTargetDriver({ driver: 'claude', target: 'actions', actionsConfig: ACTIONS })
  assert.ok(driver instanceof ActionsDriver)
})

test('createTargetDriver falls through to the driver for the chosen CLI otherwise', () => {
  assert.ok(createTargetDriver({ driver: 'claude' }) instanceof ClaudeCodeDriver)
  assert.ok(createTargetDriver({ driver: 'claude', target: 'local' }) instanceof ClaudeCodeDriver)
  assert.ok(createTargetDriver({ driver: 'codex', target: 'local' }) instanceof CodexDriver)
})

test('createTargetDriver requires the Actions config when target is "actions"', () => {
  assert.throws(() => createTargetDriver({ driver: 'claude', target: 'actions' }), /needs the repo owner/)
})

test('createTargetDriver returns a CloudDriver for target "web"', () => {
  assert.ok(createTargetDriver({ driver: 'claude', target: 'web' }) instanceof CloudDriver)
})

test('the web target needs no configuration: the CLI already holds the account', () => {
  assert.doesNotThrow(() => createTargetDriver({ driver: 'claude', target: 'web' }))
})
