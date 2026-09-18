import type { FrameworkEvent } from '../../src/index.js'
import { agentOutcome } from './live-state.js'

/** How an agent's one status pill is drawn: its dot colour, its word, and the word's tone. */
export type AgentStatusPill = { dot: string; label: string; tone: string }

/**
 * The one status pill an agent's ending earns, or null while it has not ended, or ended clean.
 *
 * The states are exclusive — one agent, one word: failed (with the ending's detail when there is
 * one), stopped, or waiting for an answer. Shared so the session toolbar and the overview cannot
 * drift apart on what an agent is.
 */
export function agentStatusPill(events: FrameworkEvent[]): AgentStatusPill | null {
  const outcome = agentOutcome(events)
  if (!outcome) return null
  if (outcome.stopped) return { dot: 'bg-warning', label: 'stopped', tone: 'text-warning' }
  if (outcome.waiting) return { dot: 'bg-warning', label: 'waiting for an answer', tone: 'text-warning' }
  if (!outcome.ok) return { dot: 'bg-danger', label: outcome.detail ? `failed — ${outcome.detail}` : 'failed', tone: 'text-danger' }
  return null
}
