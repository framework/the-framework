/**
 * What a session hands back when it finishes (#1102/#1216) — one ordinal, not three booleans (B5).
 *
 * These are strictly nested stages of one pipeline: push the branch, then open a PR for it, then
 * merge that PR. As three independent booleans they described eight states of which four were
 * reachable, and the implication had to be written in a doc comment because the type could not
 * express it — `autoOpenPr` "implies `autoPushBranch`", so "PR without push" was never a state a
 * session could honour. It used to resolve that contradiction by turning push back *on*, which
 * meant a launcher offering "publish nothing" could not deliver it (#1379).
 *
 * One ordinal has exactly the four real states, and the implication is structural: a rung includes
 * every rung under it, so the impossible combinations stop being representable.
 *
 * Node-free, like `run-location.ts`: the dashboard, the registry and the repo file all name this,
 * and none of them should reach further than a leaf to do it.
 */

/** How far a finished session publishes itself. Each rung includes the ones below it. */
export type HandoffLevel = 'local' | 'push' | 'pr' | 'merge'

/** Every rung, lowest first — the order is the ladder. */
export const HANDOFF_LEVELS = ['local', 'push', 'pr', 'merge'] as const

/**
 * Where the ladder sits when nobody has said.
 *
 * `pr`, because that is what makes the handoff zero-config: a session left alone pushes its branch
 * and opens a draft PR, so the work never sits on a local branch nobody is told about (#1102).
 * Merging is the one rung above it, and landing on the default branch has to be asked for (#1216).
 */
export const DEFAULT_HANDOFF: HandoffLevel = 'pr'

/** Whether `value` names a rung. */
export function isHandoffLevel(value: unknown): value is HandoffLevel {
  return typeof value === 'string' && (HANDOFF_LEVELS as readonly string[]).includes(value)
}

/** True when `level` reaches `rung` or beyond — the ladder's one comparison. */
export function handoffReaches(level: HandoffLevel, rung: HandoffLevel): boolean {
  return HANDOFF_LEVELS.indexOf(level) >= HANDOFF_LEVELS.indexOf(rung)
}

/**
 * The ladder as the three questions the agent and the UI actually ask of it.
 *
 * Derived rather than stored: this is a view of the ordinal, so a caller can keep saying "is the
 * push armed" without any of them being able to disagree with each other.
 */
export function handoffStages(level: HandoffLevel): { push: boolean; pr: boolean; merge: boolean } {
  return {
    push: handoffReaches(level, 'push'),
    pr: handoffReaches(level, 'pr'),
    merge: handoffReaches(level, 'merge'),
  }
}

/**
 * The rung a set of stage answers means, for a surface that offers them as separate checkboxes.
 *
 * The inverse of {@link handoffStages}, and the reason an impossible answer cannot survive: the
 * highest rung whose own box is ticked *and* whose every rung below is ticked too wins, so
 * "PR without push" resolves down to `local` rather than silently turning the push back on.
 */
export function handoffFromStages(stages: { push?: boolean; pr?: boolean; merge?: boolean }): HandoffLevel {
  if (!stages.push) return 'local'
  if (!stages.pr) return 'push'
  return stages.merge ? 'merge' : 'pr'
}
