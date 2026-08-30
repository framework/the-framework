import { withFileBranch } from '@gemstack/skill-branches'
import { LOGS_BRANCH } from './framework-dir.js'
import { patchArchivedAgent, type ArchivePatch } from './store/index.js'

/**
 * Patch a settled run's archived record on the logs branch (#1601): synced with origin, patched,
 * committed, pushed — the same funnel every other write to the branch goes through (#1582).
 *
 * A patch written straight into the branch's checkout is not a fact yet: the next sync's rebase
 * refuses a dirty tree and the funnel hard-resets it, so the patch is gone within a minute and
 * no other machine ever saw it. Seen live on the cloud-work adoption before it went through here.
 *
 * True when the record now carries the patch, committed; a push that could not go out rides the
 * next cycle, which is the funnel's owed-push rule. False when the run has no archive to patch.
 */
export async function patchArchivedAgentOnDataBranch(
  cwd: string,
  agentId: string,
  patch: ArchivePatch,
  message: string,
): Promise<boolean> {
  let patched = false
  const result = await withFileBranch(cwd, LOGS_BRANCH, message, async () => {
    patched = await patchArchivedAgent(cwd, agentId, patch)
  })
  return patched && (result.ok || result.committed)
}
