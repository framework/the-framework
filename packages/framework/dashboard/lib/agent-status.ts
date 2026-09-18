import type { AgentMeta, FrameworkEvent } from '../../src/index.js'
import { isAgentActive, agentOutcome, type AgentOutcome } from './live-state.js'

/** How an agent's one status pill is drawn: its dot colour, its word, and the word's tone. */
export type AgentStatusPill = { dot: string; label: string; tone: string }

/** What the pill reads off the run's card, as the daemon hands it over: its status, its pull request, and whether it is publishing. */
export type AgentCardFacts = Pick<AgentMeta, 'status' | 'pr' | 'publishing'>

/**
 * The single status an agent is in, ranked, or null while there is nothing to go on: no line in
 * the feed and no card.
 *
 * The states are deliberately exclusive — one agent, one word. An agent can hold more than one of
 * the underlying facts at once (it can have a pull request and then be stopped on a later leg, or
 * fail after opening one), so the ranking decides which one is shown: how the agent ENDED outranks
 * anything it did on the way (#948), because the green "ready for merge" would otherwise be a lie
 * about an agent that then failed or was killed.
 *
 * The feed says how the current leg ended, and the card's status says it when the feed has no
 * ending: a feed yet to arrive, or a diary whose process died before writing its last line. The
 * card also says what the feed cannot: the pull request the run's work is on, and whether the
 * run's process is still recording and pushing after a clean end. A card alone (a run whose first
 * line has not landed yet) is enough to say it builds.
 *
 * Shared so the session toolbar and the overview cannot drift apart on what an agent is.
 */
export function agentStatusPill(events: FrameworkEvent[], card?: AgentCardFacts): AgentStatusPill | null {
  const outcome = agentOutcome(events) ?? cardOutcome(card)
  if (events.length === 0 && !card) return null
  const failed = outcome !== undefined && !outcome.ok && !outcome.stopped && !outcome.waiting
  if (failed) {
    return { dot: 'bg-danger', label: outcome?.detail ? `failed — ${outcome.detail}` : 'failed', tone: 'text-danger' }
  }
  if (outcome?.stopped) return { dot: 'bg-warning', label: 'stopped', tone: 'text-warning' }
  if (outcome?.waiting) return { dot: 'bg-warning', label: 'waiting for an answer', tone: 'text-warning' }
  // Ended clean, and the run's process is still recording the run and pushing its branch (#1431):
  // an ending-side state like failed/stopped, so it sits above "ready for merge" (#948) — during
  // this window the publishing is what is actually happening.
  const endedClean = outcome?.ok === true
  if (endedClean && card?.publishing) {
    return { dot: 'animate-pulse bg-success', label: 'publishing…', tone: 'text-muted-foreground' }
  }
  if (endedClean && card?.pr) return { dot: 'bg-success', label: 'ready for merge', tone: 'text-muted-foreground' }
  // An agent only pulses "building…" while it is live (#695/U20): once its end lands the pill settles.
  if (isAgentActive(events) || (outcome === undefined && card?.status === 'running')) {
    return { dot: 'animate-pulse bg-warning', label: 'building…', tone: 'text-muted-foreground' }
  }
  return { dot: 'bg-muted-foreground', label: 'finished', tone: 'text-muted-foreground' }
}

/** How the card says the run ended, for a feed that says no ending; undefined while it is going. */
function cardOutcome(card: AgentCardFacts | undefined): AgentOutcome | undefined {
  if (!card || card.status === 'running') return undefined
  return {
    ok: card.status === 'done',
    stopped: card.status === 'stopped',
    ...(card.status === 'waiting' ? { waiting: true } : {}),
  }
}
