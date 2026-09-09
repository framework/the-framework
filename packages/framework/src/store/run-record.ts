import type { DriverEvent } from 'agent-driver'
import type { AnyDiaryLine, RunCard } from '@gemstack/skill-logs'
import type { FrameworkEvent } from '../events.js'
import type { AgentMeta } from './agent-store.js'

/**
 * The framework's run, in the `logs` skill's two shapes (#1769). The skill owns what a run's card
 * says to an agent — eleven plain fields — and four kinds of diary line; everything else the
 * framework records is its own. So the card carries the framework's remaining meta under the one
 * key the skill stores and never reads, `caller`, and the diary carries the framework's other
 * events as they are, among the four the skill knows. This module is the whole mapping, both
 * ways: the daemon writes through it at teardown, and every reader of an archived run — the run
 * page's replay, the tail of an ended run, a continuation's restore — comes back through it.
 */

/** The framework's meta as the skill's card: the skill's fields on top, the rest under `caller`. */
export function toRunCard(meta: AgentMeta): RunCard {
  const { id, startedAt, endedAt, status, intent, driver, model, branch, pr, ticket, cost, ...caller } = meta
  const card: RunCard = { id, startedAt, status }
  if (endedAt !== undefined) card.endedAt = endedAt
  if (intent !== undefined) card.intent = intent
  if (driver !== undefined) card.driver = driver
  if (model !== undefined) card.model = model
  if (branch !== undefined) card.branch = branch
  if (pr !== undefined) card.pr = pr
  if (ticket !== undefined) card.ticket = ticket
  if (cost !== undefined) card.cost = cost
  if (Object.keys(caller).length > 0) card.caller = caller
  return card
}

/** The skill's card as the framework's meta: `caller` unfolded, the skill's fields winning. */
export function fromRunCard(card: RunCard): AgentMeta {
  const { caller, ...own } = card
  return { updatedAt: card.endedAt ?? card.startedAt, ...(caller as Partial<AgentMeta>), ...own } as AgentMeta
}

/**
 * One framework event as one diary line: what the agent said, its result, the run's end and its
 * cost become the skill's four kinds; every other event is written as it is, under its own kind.
 */
export function toDiaryLine(event: FrameworkEvent): AnyDiaryLine {
  switch (event.kind) {
    case 'driver': {
      if (event.event.type === 'text') return { kind: 'said', text: event.event.text }
      if (event.event.type === 'result') {
        const { type: _type, ...rest } = event.event
        return { kind: 'result', ...rest }
      }
      return event as unknown as AnyDiaryLine
    }
    case 'end':
      return {
        kind: 'ended',
        status: event.ok ? 'done' : event.stopped ? 'stopped' : 'failed',
        ...(event.detail !== undefined ? { detail: event.detail } : {}),
      }
    case 'usage': {
      const { kind: _kind, costUsd, ...rest } = event
      return { kind: 'cost', ...(costUsd !== undefined ? { usd: costUsd } : {}), ...rest }
    }
    default:
      return event as unknown as AnyDiaryLine
  }
}

/** The inverse of {@link toDiaryLine}: a line of any other kind is a framework event as written. */
export function fromDiaryLine(line: AnyDiaryLine): FrameworkEvent {
  switch (line.kind) {
    case 'said':
      return { kind: 'driver', event: { type: 'text', text: String(line['text']) } }
    case 'result': {
      const { kind: _kind, ...rest } = line
      return { kind: 'driver', event: { type: 'result', ...rest } as DriverEvent }
    }
    case 'ended':
      return {
        kind: 'end',
        ok: line['status'] === 'done',
        ...(line['status'] === 'stopped' ? { stopped: true } : {}),
        ...(typeof line['detail'] === 'string' ? { detail: line['detail'] } : {}),
      }
    case 'cost': {
      const { kind: _kind, usd, ...rest } = line
      return { kind: 'usage', ...(usd !== undefined ? { costUsd: usd } : {}), ...rest } as FrameworkEvent
    }
    default:
      return line as unknown as FrameworkEvent
  }
}

/** A run's events as its diary. */
export function diaryOf(events: readonly FrameworkEvent[]): AnyDiaryLine[] {
  return events.map(toDiaryLine)
}

/** A diary as the run's events, for a reader that replays them. */
export function eventsOf(lines: readonly AnyDiaryLine[]): FrameworkEvent[] {
  return lines.map(fromDiaryLine)
}
