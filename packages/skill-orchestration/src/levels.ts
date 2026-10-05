import type { DriverName } from '@openagt/agent-runner'

/**
 * What the person's subagent settings are, with nothing that needs Node: the command reads and
 * writes them (`settings.ts`), and the package's Settings section in the dashboard shows them.
 */

/** How hard the main agent says a task is. */
export const LEVELS = ['simple', 'hard'] as const
export type Level = (typeof LEVELS)[number]

export function isLevel(value: unknown): value is Level {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value)
}

/** How many of one main agent's subagents run at once when nobody said. */
export const DEFAULT_AT_ONCE = 4

/** A coding agent and, when one is named, its model; no model is that coding agent's own default. */
export interface Runner {
  driver: DriverName
  model?: string
}

export interface Settings {
  simple?: Runner
  hard?: Runner
  atOnce?: number
}
