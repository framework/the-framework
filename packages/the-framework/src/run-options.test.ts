import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { runOptionsFromPreferences, handoffFromPreferences, preferencesFromFileConfig } from './run-options.js'
import { resolvePreferences } from './registry.js'

test('auto-merge travels explicitly in both directions (#1216)', () => {
  assert.equal(runOptionsFromPreferences({ autoMerge: true }).autoMerge, true)
  assert.equal(runOptionsFromPreferences({ autoMerge: false }).autoMerge, false)
  assert.equal(runOptionsFromPreferences({}).autoMerge, false)
})

test('the handoff defaults to armed, and push is the rung under the PR (#1102/#1379)', () => {
  assert.deepEqual(handoffFromPreferences({}), { push: true, pr: true })
  // Turning the push rung off publishes nothing, whatever the PR half says: `gh` will not open a
  // PR for a branch the remote has never seen, so "PR without push" was never a state a run could
  // honour. It used to resolve that by forcing push back on, which left "publish nothing"
  // unreachable from the launcher — the ladder resolves it the other way.
  assert.deepEqual(handoffFromPreferences({ autoPushBranch: false }), { push: false, pr: false })
  assert.deepEqual(handoffFromPreferences({ autoPushBranch: false, autoOpenPr: true }), { push: false, pr: false })
  assert.deepEqual(handoffFromPreferences({ autoOpenPr: false }), { push: true, pr: false })
  assert.deepEqual(handoffFromPreferences({ autoPushBranch: false, autoOpenPr: false }), { push: false, pr: false })
})

test('a disarmed handoff travels as an explicit false, so the run cannot re-arm it (#1102)', () => {
  const off = runOptionsFromPreferences({ autoPushBranch: false, autoOpenPr: false })
  assert.equal(off.autoPushBranch, false)
  assert.equal(off.autoOpenPr, false)
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
  // The handoff pair rides the committed file too (#1173): the push setting's home now the
  // launcher gear offers a single `Open PR` row.
  assert.deepEqual(preferencesFromFileConfig({ autoPushBranch: false, autoOpenPr: false }), {
    autoPushBranch: false,
    autoOpenPr: false,
  })
  // And so does auto-merge (#1216): whether sessions may land their own PRs is a fact about the repo.
  assert.deepEqual(preferencesFromFileConfig({ autoMerge: true }), { autoMerge: true })
  // preset and event have no preference counterpart, so they are not mapped.
  assert.deepEqual(preferencesFromFileConfig({ preset: 'software-development', event: 'bug-fix' }), {})
})

test('a repo yml sits under the project overrides and over the global tier (#842)', () => {
  const global = { browser: true, transparent: true }
  const repo = preferencesFromFileConfig({ transparent: false, antiLazyPill: false })
  // The layer order the daemon and the launcher both use: global, repo, then the project's own.
  const resolved = resolvePreferences({ ...global, ...repo }, { vanilla: false })
  assert.equal(resolved.browser, true) // nobody nearer set it
  assert.equal(resolved.transparent, false) // the repo turned it off
  assert.equal(resolved.vanilla, false) // the project overrode the repo's antiLazyPill:false
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

test("a project's settings beat the global ones (#840/#858)", () => {
  // The path auto PM takes: resolve the two tiers, then map the answer.
  const resolved = resolvePreferences({ agent: 'claude', model: 'sonnet' }, { agent: 'codex' })
  const options = runOptionsFromPreferences(resolved)
  assert.equal(options.agent, 'codex')
  assert.equal(options.model, 'sonnet') // untouched by the project tier
})
