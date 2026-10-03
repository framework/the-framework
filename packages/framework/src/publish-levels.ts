/**
 * How far a run publishes its work when its agent finishes, node-free so every surface shares
 * one copy: the registry's preference sanitizer, the daemon's Start and the dashboard bundle.
 * The three levels are the words a project's start hook is handed as `PUBLISH`, the ones
 * `agent-runner run --publish` takes. The launcher's menu offers them after "Nothing", the pick
 * that hands the hook no level: the run then publishes nothing unless its prompt asks.
 */

/** The levels a run can be started at, each going further than the one before. */
export const PUBLISH_LEVELS = ['branch', 'pr', 'merge'] as const

/** A level: push the branch, open its pull request, or open it set to merge once its checks pass. */
export type PublishLevel = (typeof PUBLISH_LEVELS)[number]

/** What the launcher's menu lists, in its order: nothing, then each level. */
export const PUBLISH_PICKS = ['nothing', ...PUBLISH_LEVELS] as const

/** A pick of the launcher's menu. */
export type PublishPick = (typeof PUBLISH_PICKS)[number]

export const PUBLISH_LABELS: Readonly<Record<PublishPick, string>> = {
  nothing: 'Nothing',
  branch: 'Publish branch',
  pr: 'Open PR',
  merge: 'Merge on green',
}

export function isPublishLevel(value: unknown): value is PublishLevel {
  return (PUBLISH_LEVELS as readonly unknown[]).includes(value)
}

export function isPublishPick(value: unknown): value is PublishPick {
  return (PUBLISH_PICKS as readonly unknown[]).includes(value)
}

/**
 * The picks a project is offered: every one where it has a git host; without a git host no pull
 * request can be opened, so the picks stop at the branch; without a remote nothing can be
 * published at all, so the only pick is Nothing.
 */
export function offeredPublishPicks(gitHost: boolean, remote = true): readonly PublishPick[] {
  if (!remote) return ['nothing']
  return gitHost ? PUBLISH_PICKS : ['nothing', 'branch']
}

/**
 * The saved pick as this project can hold it: a pick it is not offered falls back to the furthest
 * it can publish, the branch, or Nothing where it has no remote. No saved pick is Nothing.
 */
export function publishPickIn(saved: PublishPick | undefined, gitHost: boolean, remote = true): PublishPick {
  const pick = saved ?? 'nothing'
  if (offeredPublishPicks(gitHost, remote).includes(pick)) return pick
  return remote ? 'branch' : 'nothing'
}

/** The level a pick hands the start hook; none for Nothing. */
export function publishLevelOf(pick: PublishPick): PublishLevel | undefined {
  return pick === 'nothing' ? undefined : pick
}
