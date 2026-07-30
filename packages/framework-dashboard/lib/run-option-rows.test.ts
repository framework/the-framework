import { describe, expect, test } from 'vitest'
import type { Preferences } from '@gemstack/the-framework'
import { runOptionRows, type OptionRow } from './run-option-rows.js'

// The rules between the run options (#314/#625/#801/#958). They live in one table because two
// surfaces render them (the launcher gear and the settings page); these pin the rules themselves,
// so neither surface can quietly disagree with the other.

const rows = (preferences: Preferences) => runOptionRows(preferences)
const find = (list: OptionRow[], key: string) => list.find(r => r.key === key)!

describe('runOptionRows', () => {
  test('the publish ladder shows all three rungs, in order, both on by default (#1379)', () => {
    // The pair this replaced showed only Open PR, so "Open PR: off" silently meant push-only — the
    // launcher said publishing was off while the session header armed "Push branch: on".
    const main = rows({}).main
    const ladder = main.filter(r => ['autoPushBranch', 'autoOpenPr', 'autoMerge'].includes(r.key))
    expect(ladder.map(r => r.key)).toEqual(['autoPushBranch', 'autoOpenPr', 'autoMerge'])
    expect(find(main, 'autoPushBranch').checked).toBe(true)
    expect(find(main, 'autoOpenPr').checked).toBe(true)
    expect(find(rows({ autoOpenPr: false }).main, 'autoOpenPr').checked).toBe(false)
  })

  test('Open PR needs Push branch, and unticking push disarms the whole ladder (#1379)', () => {
    // The gating is what makes the contradictory state (PR on / push off) unreachable, and what
    // finally makes "publish nothing" expressible from the launcher.
    const noPush = rows({ autoPushBranch: false, autoOpenPr: true, autoMerge: true }).main
    expect(find(noPush, 'autoPushBranch').checked).toBe(false)
    const pr = find(noPush, 'autoOpenPr')
    expect(pr.checked).toBe(false)
    expect(pr.disabled).toBe(true)
    expect(pr.disabledReason).toMatch(/Push branch/)
    // The rung above it goes with it rather than staying live over a disarmed PR.
    expect(find(noPush, 'autoMerge').checked).toBe(false)
    expect(find(noPush, 'autoMerge').disabled).toBe(true)
    // With push on, Open PR is an ordinary live row again.
    expect(find(rows({}).main, 'autoOpenPr').disabled).toBeUndefined()
  })

  test('Auto-merge is off by default and needs Open PR to mean anything (#1216)', () => {
    // Default-off, unlike the row above: publishing a branch is reversible, landing it on the
    // default branch is not.
    const main = rows({}).main
    expect(find(main, 'autoMerge').checked).toBe(false)
    expect(find(main, 'autoMerge').disabled).toBeUndefined()
    expect(find(rows({ autoMerge: true }).main, 'autoMerge').checked).toBe(true)
    // With Open PR off there is nothing to merge: effective value off, and the row says why.
    const noPr = find(rows({ autoMerge: true, autoOpenPr: false }).main, 'autoMerge')
    expect(noPr.checked).toBe(false)
    expect(noPr.disabled).toBe(true)
  })

  test('autopilot is on by default, and off only when explicitly turned off', () => {
    expect(find(rows({}).main, 'autopilot').checked).toBe(true)
    expect(find(rows({ autopilot: false }).main, 'autopilot').checked).toBe(false)
  })

  test('Transparent overrides the options below it: they read off and cannot be changed (#625)', () => {
    const main = rows({
      transparent: true,
      autopilot: true,
      technical: true,
      vanilla: true,
      onBeforeMergeableQuality: true,
      browser: true,
    }).main

    for (const key of ['autopilot', 'technical', 'vanilla', 'onBeforeMergeableQuality', 'browser']) {
      const row = find(main, key)
      // Effective, not stored: the run ignores it, so the box must not claim it is on.
      expect(row.checked, `${key} checked`).toBe(false)
      expect(row.disabled, `${key} disabled`).toBe(true)
    }
    // Transparent itself stays on and available.
    expect(find(main, 'transparent').checked).toBe(true)
    expect(find(main, 'transparent').disabled).toBeUndefined()
  })

  test('Eco has nothing to trim once the system prompt is off (Vanilla or Transparent)', () => {
    expect(find(rows({ eco: true, vanilla: true }).main, 'eco')).toMatchObject({
      checked: false,
      disabled: true,
      disabledReason: 'nothing to trim while the system prompt is off',
    })
    expect(find(rows({ eco: true, transparent: true }).main, 'eco').disabled).toBe(true)
    // Plain Eco, nothing else set: available and on.
    expect(find(rows({ eco: true }).main, 'eco').checked).toBe(true)
    expect(find(rows({ eco: true }).main, 'eco').disabled).toBeUndefined()
  })

  test('Browser is Claude-only, because it rides Claude Code’s MCP config (#801)', () => {
    const onCodex = find(rows({ browser: true, agent: 'codex' }).main, 'browser')
    expect(onCodex.checked).toBe(false)
    expect(onCodex.disabled).toBe(true)
    expect(onCodex.disabledReason).toMatch(/only on Claude Code/)

    const onClaude = find(rows({ browser: true, agent: 'claude' }).main, 'browser')
    expect(onClaude.checked).toBe(true)
    expect(onClaude.disabled).toBeUndefined()
  })

  test('an unknown stored agent is not Claude Code, so Browser stays disabled', () => {
    // The *label* falls back to Claude Code, but the Browser rule tests the stored value directly.
    // Carried over from the launcher deliberately: the fallback is cosmetic, and treating an
    // unrecognised agent as Claude would offer a browser its driver cannot wire up.
    const row = find(rows({ browser: true, agent: 'nope' }).main, 'browser')
    expect(row.checked).toBe(false)
    expect(row.disabled).toBe(true)
  })

  test('the Eco drops apply only while Eco itself is in force', () => {
    const off = rows({ ecoPlanning: true, ecoResearch: true }).eco
    for (const key of ['ecoPlanning', 'ecoResearch']) {
      expect(find(off, key), key).toMatchObject({
        checked: false,
        disabled: true,
        disabledReason: 'only applies while Eco is on',
      })
    }
    const on = find(rows({ eco: true, ecoPlanning: true }).eco, 'ecoPlanning')
    expect(on.checked).toBe(true)
    expect(on.disabled).toBeUndefined()
  })

  test('Auto maintenance trims nothing unless Post-merge cleanup runs (#556/#801)', () => {
    expect(find(rows({ eco: true, ecoMaintenance: true }).eco, 'ecoMaintenance')).toMatchObject({
      checked: false,
      disabled: true,
      disabledReason: 'only applies while Post-merge cleanup is on',
    })
    const live = find(rows({ eco: true, ecoMaintenance: true, onBeforeMergeableQuality: true }).eco, 'ecoMaintenance')
    expect(live.checked).toBe(true)
    expect(live.disabled).toBeUndefined()
  })

  test('Transparent names the agent actually selected, so the label is never a lie (#948)', () => {
    expect(find(rows({ agent: 'codex' }).main, 'transparent').description).toMatch(/Codex/)
    expect(find(rows({ agent: 'claude' }).main, 'transparent').description).toMatch(/Claude/)
  })
})
