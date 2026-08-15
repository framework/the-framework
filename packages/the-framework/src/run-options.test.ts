import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { runOptionsFromPreferences, handoffFromPreferences, preferencesFromFileConfig } from './run-options.js'

test('the handoff defaults to the PR rung, and every rung travels explicitly (#1102/#1216)', () => {
  // Unset is `pr`, which is what makes the handoff zero-config: a session left alone pushes its
  // branch and opens a draft PR rather than leaving work on a local branch nobody was told about.
  assert.equal(handoffFromPreferences({}), 'pr')
  assert.equal(runOptionsFromPreferences({}).handoff, 'pr')
  for (const level of ['local', 'push', 'pr', 'merge'] as const) {
    assert.equal(handoffFromPreferences({ handoff: level }), level)
    // Explicit on the wire, so a run can never re-arm what the launcher disarmed.
    assert.equal(runOptionsFromPreferences({ handoff: level }).handoff, level)
  }
})

test('the yml-owned toggles travel as explicit booleans (#842)', () => {
  const off = runOptionsFromPreferences({ vanilla: false, transparent: false })
  assert.deepEqual({ vanilla: off.vanilla, transparent: off.transparent }, { vanilla: false, transparent: false })
  const on = runOptionsFromPreferences({ vanilla: true, transparent: true })
  assert.deepEqual({ vanilla: on.vanilla, transparent: on.transparent }, { vanilla: true, transparent: true })
})

test('preferencesFromFileConfig maps the repo yml onto the preference keys (#842)', () => {
  assert.deepEqual(preferencesFromFileConfig({}), {})
  // antiLazyPill is the file's name for the inverse of Vanilla.
  assert.deepEqual(preferencesFromFileConfig({ antiLazyPill: false }), { vanilla: true })
  assert.deepEqual(preferencesFromFileConfig({ antiLazyPill: true }), { vanilla: false })
  assert.deepEqual(preferencesFromFileConfig({ transparent: true }), { transparent: true })
  // The ladder rides the committed file too (#1173/#1216): how far a session publishes itself —
  // including whether its PRs may land on their own — is a fact about the repo.
  assert.deepEqual(preferencesFromFileConfig({ handoff: 'local' }), { handoff: 'local' })
  assert.deepEqual(preferencesFromFileConfig({ handoff: 'merge' }), { handoff: 'merge' })
  // preset and event have no preference counterpart, so they are not mapped.
  assert.deepEqual(preferencesFromFileConfig({ preset: 'software-development', event: 'bug-fix' }), {})
})

test('a repo yml sits over the user tier, key by key (#842)', () => {
  // Two tiers (B5): yours, and the repo's committed file on top. A repo-shaped setting belongs to
  // the repo, so a per-machine override of it is a third answer to a question with two.
  const global = { browser: true, transparent: true, vanilla: true }
  const repo = preferencesFromFileConfig({ transparent: false, antiLazyPill: false })
  const resolved = { ...global, ...repo }
  assert.equal(resolved.browser, true) // the repo said nothing, so yours stands
  assert.equal(resolved.transparent, false) // an explicit false in the repo wins, not just a true
  assert.equal(resolved.vanilla, true) // the repo's antiLazyPill:false maps to exactly this key
})

test('the agent is sent only when it is not the default (#858)', () => {
  // The daemon spells this out as a flag, and `--agent claude` is the default anyway.
  assert.equal(runOptionsFromPreferences({ agent: 'claude' }).agent, undefined)
  assert.equal(runOptionsFromPreferences({ agent: 'codex' }).agent, 'codex')
})

test('the model passes through, and an empty one does not (#858)', () => {
  assert.equal(runOptionsFromPreferences({ model: 'opus' }).model, 'opus')
  assert.equal(runOptionsFromPreferences({ model: '' }).model, undefined)
})

test('the run target is sent only when it is not the default local (#1050)', () => {
  assert.equal(runOptionsFromPreferences({}).target, undefined)
  assert.equal(runOptionsFromPreferences({ target: 'local' }).target, undefined)
  assert.equal(runOptionsFromPreferences({ target: 'actions' }).target, 'actions')
})

test('browser is dropped for an agent that cannot use it (#801)', () => {
  assert.equal(runOptionsFromPreferences({ browser: true }).browser, true)
  assert.equal(runOptionsFromPreferences({ browser: true, agent: 'codex' }).browser, undefined)
})

test("the repo's file beats your own settings (#842/#858)", () => {
  // The path auto PM takes: merge the two tiers, then map the answer.
  const resolved = { ...{ transparent: false, model: 'sonnet' }, ...preferencesFromFileConfig({ transparent: true }) }
  const options = runOptionsFromPreferences(resolved)
  assert.equal(options.transparent, true)
  assert.equal(options.model, 'sonnet') // untouched by the repo tier
})
