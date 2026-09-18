import type { DriverEvent } from 'agent-driver'
import type { AnyDiaryLine, RunCard } from '@gemstack/skill-logs'
import type { ChoiceOption, FrameworkEvent } from '../events.js'
import type { AgentMeta } from './agent-store.js'

/**
 * A recorded run, read as the framework's own shapes (#1769). The `logs` skill owns what a run's
 * card says (eleven plain fields) and four kinds of diary line; whoever wrote the run keeps the
 * rest of what it knows under the one key the skill stores and never reads, `caller`, and writes
 * its other lines as they are. This module is the reading half of that mapping: the card as the
 * meta every list shows, the diary as the events the run page replays and tails. The framework
 * records no run of its own (#1774), so there is no other half.
 */

/** The skill's card as the framework's meta: `caller` unfolded, the skill's fields winning. */
export function fromRunCard(card: RunCard): AgentMeta {
  const { caller, ...own } = card
  return { updatedAt: card.endedAt ?? card.startedAt, ...(caller as Partial<AgentMeta>), ...own } as AgentMeta
}

/**
 * One diary line as one framework event: what the agent said, its result, the run's end and its
 * cost are the skill's four kinds; a line of any other kind is a framework event as written.
 */
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
        ...(line['status'] === 'waiting' ? { waiting: true } : {}),
        ...(typeof line['detail'] === 'string' ? { detail: line['detail'] } : {}),
      }
    // An error line with a headline is the agent's own `error` block, from a run recorded before the
    // daemon stopped running agents; any other is agent-driver's, a driver's message.
    case 'error': {
      if (typeof line['headline'] === 'string') {
        return { kind: 'error', headline: line['headline'], ...(typeof line['detail'] === 'string' ? { detail: line['detail'] } : {}) }
      }
      const { kind: _kind, ...rest } = line
      return { kind: 'driver', event: { type: 'error', ...rest } as DriverEvent }
    }
    // The lines agent-driver's own log writes (its `session-log.ts`): a driver event per kind, the
    // agent's session id, and the question a turn ended on as the gate the dashboard shows.
    case 'start':
    case 'action':
    case 'rate-limit':
    case 'notice': {
      const { kind, ...rest } = line
      return { kind: 'driver', event: { type: kind, ...rest } as DriverEvent }
    }
    case 'session':
      if (typeof line['sessionId'] === 'string' && line['driver'] === undefined) return { kind: 'session-update', sessionId: line['sessionId'] }
      return line as unknown as FrameworkEvent
    case 'question': {
      const { kind: _kind, title, options, recommended, multi, file } = line
      return {
        kind: 'choice',
        id: 'await-choices',
        title: String(title ?? 'Which option?'),
        options: Array.isArray(options) ? (options as ChoiceOption[]) : [],
        ...(typeof recommended === 'string' ? { recommended } : {}),
        ...(multi === true ? { multi: true } : {}),
        ...(typeof file === 'string' ? { file } : {}),
      } as FrameworkEvent
    }
    case 'cost': {
      const { kind: _kind, usd, ...rest } = line
      return { kind: 'usage', ...(usd !== undefined ? { costUsd: usd } : {}), ...rest } as FrameworkEvent
    }
    default:
      return line as unknown as FrameworkEvent
  }
}

/** A diary as the run's events, for a reader that replays them. */
export function eventsOf(lines: readonly AnyDiaryLine[]): FrameworkEvent[] {
  return lines.map(fromDiaryLine)
}
