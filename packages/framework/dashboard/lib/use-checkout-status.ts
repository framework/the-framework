import { useEffect, useState } from 'react'
import type { AgentWorktree, GitStatus } from '../../src/index.js'
import { onAgentWorktree, onGitStatus } from '../rpc/reads.js'
import { PR_PENDING_MS } from './use-agent-handoff.js'
import { usePolled } from './use-async.js'

/**
 * The checkout in play, polled: with an `agentId` that agent's own (its branch, its pull request,
 * and its checkout while it has one), without one the project's. `null` until its own answer is in,
 * or what was read last time for the same checkout. `enabled` false reads nothing.
 */
export function useCheckoutStatus(projectId: string, agentId: string | null | undefined, enabled = true): GitStatus | AgentWorktree | null {
  // Resting cadence is ten seconds, but a PR lookup still in flight (#1028) is an answer that
  // lands in under a second — worth asking again for rather than showing a gap for ten.
  const [everyMs, setEveryMs] = useState(10_000)
  const { value: status } = usePolled<GitStatus | AgentWorktree | null>(
    enabled ? () => (agentId ? onAgentWorktree(projectId, agentId) : onGitStatus(projectId)) : null,
    null,
    everyMs,
    [projectId, agentId, everyMs, enabled],
    // A checkout seen before shows what was read last time at once, while it is read again. One
    // never seen shows no facts until its own answer: never the previous session's, which read as
    // this one's for the beat the read took.
    { remember: agentId ? `worktree:${projectId}:${agentId}` : `git-status:${projectId}` },
  )
  useEffect(() => setEveryMs(status?.prPending ? PR_PENDING_MS : 10_000), [status?.prPending])
  return status
}
