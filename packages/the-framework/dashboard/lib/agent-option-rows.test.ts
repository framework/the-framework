import { describe, expect, test } from 'vitest'
import type { Preferences } from '../../dist/index.js'
import { agentOptionRows, type OptionRow } from './agent-option-rows.js'

// The rules between the agent options (#314/#625/#801/#958). They live in one table because two
// surfaces render them (the launcher gear and the settings page); these pin the rules themselves,
// so neither surface can quietly disagree with the other.

const rows = (preferences: Preferences) => agentOptionRows(preferences)
const find = (list: OptionRow[], key: string) => list.find(r => r.key === key)!

describe('agentOptionRows', () => {
  test('the publish ladder shows all three rungs, in order, up to PR by default (#1379)', () => {
    // The pair this replaced showed only Open PR, so "Open PR: off" silently meant push-only — the
    // launcher said publishing was off while the session header armed "Push branch: on".
    const main = rows({}).main
    const ladder = main.filter(r => ['push', 'pr', 'merge'].includes(r.key))
    expect(ladder.map(r => r.key)).toEqual(['push', 'pr', 'merge'])
    expect(find(main, 'push').checked).toBe(true)
    expect(find(main, 'pr').checked).toBe(true)
    expect(find(rows({ handoff: 'push' }).main, 'pr').checked).toBe(false)
  })

  test('each rung writes the level it means, so unticking one lowers the ladder (B5)', () => {
    // Three boxes over one stored ordinal: what a box *writes* is the rung it stands for, which is
    // why "PR off" can never leave a merge armed with nothing under it.
    const main = rows({ handoff: 'merge' }).main
    expect(find(main, 'pr').patch(false)).toEqual({ handoff: 'push' })
    expect(find(main, 'push').patch(false)).toEqual({ handoff: 'local' })
    expect(find(main, 'merge').patch(true)).toEqual({ handoff: 'merge' })
    expect(find(main, 'merge').patch(false)).toEqual({ handoff: 'pr' })
    // An ordinary row still just writes its own key.
    expect(find(main, 'browser').patch(true)).toEqual({ browser: true })
  })

  test('Open PR needs Push branch, and a disarmed ladder disarms every rung above (#1379)', () => {
    // The gating is what makes the contradictory state (PR on / push off) unreachable, and what
    // finally makes "publish nothing" expressible from the launcher.
    const noPush = rows({ handoff: 'local' }).main
    expect(find(noPush, 'push').checked).toBe(false)
    const pr = find(noPush, 'pr')
    expect(pr.checked).toBe(false)
    expect(pr.disabled).toBe(true)
    expect(pr.disabledReason).toMatch(/Push branch/)
    // The rung above it goes with it rather than staying live over a disarmed PR.
    expect(find(noPush, 'merge').checked).toBe(false)
    expect(find(noPush, 'merge').disabled).toBe(true)
    // With push on, Open PR is an ordinary live row again.
    expect(find(rows({}).main, 'pr').disabled).toBeUndefined()
  })

  test('Auto-merge is off by default and needs Open PR to mean anything (#1216)', () => {
    // Default-off, unlike the row above: publishing a branch is reversible, landing it on the
    // default branch is not.
    const main = rows({}).main
    expect(find(main, 'merge').checked).toBe(false)
    expect(find(main, 'merge').disabled).toBeUndefined()
    expect(find(rows({ handoff: 'merge' }).main, 'merge').checked).toBe(true)
    // With Open PR off there is nothing to merge: effective value off, and the row says why.
    const noPr = find(rows({ handoff: 'push' }).main, 'merge')
    expect(noPr.checked).toBe(false)
    expect(noPr.disabled).toBe(true)
  })

  test('Transparent overrides the options below it: they read off and cannot be changed (#625)', () => {
    const main = rows({
      transparent: true,
      browser: true,
      vanilla: true,
      onBeforeMergeableQuality: true,
    }).main

    for (const key of ['browser', 'vanilla', 'onBeforeMergeableQuality']) {
      const row = find(main, key)
      // Effective, not stored: the agent ignores it, so the box must not claim it is on.
      expect(row.checked, `${key} checked`).toBe(false)
      expect(row.disabled, `${key} disabled`).toBe(true)
    }
    // Transparent itself stays on and available.
    expect(find(main, 'transparent').checked).toBe(true)
    expect(find(main, 'transparent').disabled).toBeUndefined()
  })

  test('Browser is Claude-only, because it rides Claude Code’s MCP config (#801)', () => {
    const onCodex = find(rows({ browser: true, driver: 'codex' }).main, 'browser')
    expect(onCodex.checked).toBe(false)
    expect(onCodex.disabled).toBe(true)
    expect(onCodex.disabledReason).toMatch(/only on Claude Code/)

    const onClaude = find(rows({ browser: true, driver: 'claude' }).main, 'browser')
    expect(onClaude.checked).toBe(true)
    expect(onClaude.disabled).toBeUndefined()
  })

  test('an unknown stored agent is not Claude Code, so Browser stays disabled', () => {
    // The *label* falls back to Claude Code, but the Browser rule tests the stored value directly.
    // Carried over from the launcher deliberately: the fallback is cosmetic, and treating an
    // unrecognised agent as Claude would offer a browser its driver cannot wire up.
    const row = find(rows({ browser: true, driver: 'nope' }).main, 'browser')
    expect(row.checked).toBe(false)
    expect(row.disabled).toBe(true)
  })

  test('Transparent names the agent actually selected, so the label is never a lie (#948)', () => {
    expect(find(rows({ driver: 'codex' }).main, 'transparent').description).toMatch(/Codex/)
    expect(find(rows({ driver: 'claude' }).main, 'transparent').description).toMatch(/Claude/)
  })
})
