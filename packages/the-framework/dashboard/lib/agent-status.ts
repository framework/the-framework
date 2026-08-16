import type { FrameworkEvent } from '../../dist/index.js'
import { agentProgress } from '../../dist/client.js'
import { isPublishing, isAgentActive, agentOutcome } from './live-state.js'

/** How an agent's one status pill is drawn: its dot colour, its word, and the word's tone. */
export type AgentStatusPill = { dot: string; label: string; tone: string }

/**
 * The single status an agent is in, ranked, or null while it has said nothing worth a pill.
 *
 * The states are deliberately exclusive — one agent, one word. An agent can hold more than one of
 * the underlying facts at once (it can signal ready-for-merge and then be stopped, or fail
 * after signalling it), so the ranking decides which one is shown: how the agent ENDED outranks
 * anything it said on the way (#948), because the green "ready for merge" would otherwise be a
 * lie about an agent that then failed or was killed.
 *
 * Shared so the session toolbar and the overview cannot drift apart on what an agent is.
 */
export function agentStatusPill(events: FrameworkEvent[]): AgentStatusPill | null {
  const progress = agentProgress(events)
  const outcome = agentOutcome(events)
  const failed = outcome !== undefined && !outcome.ok && !outcome.stopped
  const stopped = outcome?.stopped === true
  // Nothing to say yet: an agent that has not named itself, reached a state, or ended.
  if (!progress.sessionName && !progress.readyForMerge && !failed && !stopped) return null
  if (failed) {
    return { dot: 'bg-danger', label: outcome?.detail ? `failed — ${outcome.detail}` : 'failed', tone: 'text-danger' }
  }
  if (stopped) return { dot: 'bg-warning', label: 'stopped', tone: 'text-warning' }
  // Ended clean, handoff armed, no `handoff` report yet (#1431): the epilogue is still
  // pushing/opening the PR/merging. An ending-side state like failed/stopped, so it sits above
  // the on-the-way "ready for merge" (#948) — during this window the publishing, the merge
  // itself included, is what is actually happening.
  if (isPublishing(events)) {
    return { dot: 'animate-pulse bg-success', label: 'publishing…', tone: 'text-muted-foreground' }
  }
  if (progress.readyForMerge) return { dot: 'bg-success', label: 'ready for merge', tone: 'text-muted-foreground' }
  // An agent only pulses "building…" while it is live (#695/U20): once `end` lands the pill settles.
  if (isAgentActive(events)) return { dot: 'animate-pulse bg-warning', label: 'building…', tone: 'text-muted-foreground' }
  return { dot: 'bg-muted-foreground', label: 'finished', tone: 'text-muted-foreground' }
}
