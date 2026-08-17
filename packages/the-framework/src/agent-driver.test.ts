import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createAgentDriver } from './agent-driver.js'
import { ActionsDriver, ClaudeCodeDriver, CloudDriver, CodexDriver } from './driver/index.js'

// The run-target wrapper (#1050/#610): `--run-on actions` becomes an ActionsDriver (#934),
// `--run-on web` a CloudDriver; anything else falls through to the local agent driver,
// byte-identical to before.

const ACTIONS = { owner: 'gemstack-land', repo: 'gemstack', token: 't' }

test('createAgentDriver returns an ActionsDriver for target "actions"', () => {
  const driver = createAgentDriver({ driver: 'claude', target: 'actions', actionsConfig: ACTIONS })
  assert.ok(driver instanceof ActionsDriver)
})

test('createAgentDriver falls through to the local agent driver otherwise', () => {
  assert.ok(createAgentDriver({ driver: 'claude' }) instanceof ClaudeCodeDriver)
  assert.ok(createAgentDriver({ driver: 'claude', target: 'local' }) instanceof ClaudeCodeDriver)
  assert.ok(createAgentDriver({ driver: 'codex', target: 'local' }) instanceof CodexDriver)
})

test('createAgentDriver requires the Actions config when target is "actions"', () => {
  assert.throws(() => createAgentDriver({ driver: 'claude', target: 'actions' }), /needs the repo owner/)
})

test('createAgentDriver returns a CloudDriver for target "web"', () => {
  assert.ok(createAgentDriver({ driver: 'claude', target: 'web' }) instanceof CloudDriver)
})

test('the web target needs no configuration: the CLI already holds the account', () => {
  assert.doesNotThrow(() => createAgentDriver({ driver: 'claude', target: 'web' }))
})
