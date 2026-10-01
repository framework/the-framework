import type { AgentMeta, FrameworkEvent } from '../../src/index.js'
import { isAgentActive, agentOutcome, type AgentOutcome } from './live-state.js'

/**
 * How an agent's one status pill is drawn: its dot colour, its word, the word's tone, and, for a
 * failure, the reason apart from the word, so a tight row can show the word and keep the reason
 * for its hover.
 */
export type AgentStatusPill = { dot: string; label: string; tone: string; detail?: string }

/** What the pill reads off the run's card, as the daemon hands it over: its status, its pull request, and whether it is saving. */
export type AgentCardFacts = Pick<AgentMeta, 'status' | 'pr' | 'saving'>

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
 * run's process is still saving its record after a clean end. A card alone (a run whose first
 * line has not landed yet) is enough to say it builds. How many of the run's subagents are still
 * working comes from the runs list: neither the feed nor the card of this run knows it.
 *
 * Shared so the session toolbar and the overview cannot drift apart on what an agent is.
 */
export function agentStatusPill(events: FrameworkEvent[], card?: AgentCardFacts, subagentsRunning = 0): AgentStatusPill | null {
  const outcome = agentOutcome(events) ?? cardOutcome(card)
  if (events.length === 0 && !card) return null
  const failed = outcome !== undefined && !outcome.ok && !outcome.stopped && !outcome.waiting
  if (failed) {
    return { dot: 'bg-danger', label: 'failed', tone: 'text-danger', ...(outcome?.detail ? { detail: outcome.detail } : {}) }
  }
  if (outcome?.stopped) return { dot: 'bg-warning', label: 'stopped', tone: 'text-warning' }
  if (outcome?.waiting) return { dot: 'bg-warning', label: 'waiting for an answer', tone: 'text-warning' }
  // Ended clean, and the run's process is still saving its record and cleaning up its checkout (#1431):
  // an ending-side state like failed/stopped, so it sits above "ready for merge" (#948) — during
  // this window the saving is what is actually happening.
  const endedClean = outcome?.ok === true
  if (endedClean && card?.saving) {
    return { dot: 'animate-pulse bg-success', label: 'saving…', tone: 'text-muted-foreground' }
  }
  // Ended clean with subagents still working: the agent's own turn is over, the job is not. It is
  // told as each one ends, so the pill says what the page waits on rather than "finished".
  if (endedClean && subagentsRunning > 0) {
    return { dot: 'animate-pulse bg-primary', label: `${subagentsRunning} subagent${subagentsRunning === 1 ? '' : 's'} running`, tone: 'text-muted-foreground' }
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
