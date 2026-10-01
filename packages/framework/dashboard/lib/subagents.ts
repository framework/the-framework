import type { AgentMeta, FrameworkEvent } from '../../src/index.js'
import { startedAtFromAgentId } from '../../src/agent-id.js'
import { agentLabel } from './agent-label.js'

// A run started for another run is that run's subagent: its card names the other run as its
// parent. Everything the dashboard shows about subagents (the rail's tree, the rows in the main
// agent's chat, the line above its message box) is read off that one field.

/** A run's subagents, in the order they were started: an id sorts by start time. */
export function subagentsOf(agents: readonly AgentMeta[], id: string): AgentMeta[] {
  return agents.filter(agent => agent.parent === id).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** What a subagent's row calls it: the first line of what it was asked. */
export function taskLabel(agent: Pick<AgentMeta, 'id' | 'intent' | 'branch' | 'startedAt'>): string {
  return agentLabel(agent).split('\n')[0]!.trim()
}

/** A subagent that is not over: working, or stopped on a question. */
export function isOpenSubagent(agent: Pick<AgentMeta, 'status'>): boolean {
  return agent.status === 'running' || agent.status === 'waiting'
}

/** How long after a subagent ended its main agent may still be on its way back to work. */
const CONTINUING_MS = 10_000

/**
 * A subagent its main agent's job is not over with: working, saving its record, or ended so
 * recently that the main agent is still being continued with its end. A main agent is continued
 * a few seconds after its subagent's card says it ended, and for that moment both read as ended.
 */
export function holdsMainAgent(agent: Pick<AgentMeta, 'status' | 'saving' | 'endedAt'>, now: number): boolean {
  if (agent.status === 'running' || agent.saving === true) return true
  return agent.endedAt !== undefined && now - Date.parse(agent.endedAt) < CONTINUING_MS
}

/** A row of a list of runs, as the tree needs it: a key that ends with the run's id, and the run. */
type TreeRow = { key: string; agent: AgentMeta }

/**
 * A list of runs as a tree one level deep: a run whose parent is in the list sits under it, in
 * the order the subagents were started, and every other run keeps its place. A run whose parent
 * is not in the list, or is itself under another run, stays a row of its own.
 */
export function nestRows<R extends TreeRow>(rows: readonly R[]): { row: R; subagents: R[] }[] {
  const byKey = new Map(rows.map(row => [row.key, row]))
  // The parent's key is the row's own with the parent's id in place of the run's: a list that
  // pools several projects prefixes each key with its project, and a parent is in the same one.
  const parentOf = (row: R): R | undefined =>
    row.agent.parent !== undefined ? byKey.get(row.key.slice(0, row.key.length - row.agent.id.length) + row.agent.parent) : undefined
  const under = (row: R): R | undefined => {
    const parent = parentOf(row)
    return parent && !parentOf(parent) ? parent : undefined
  }
  return rows
    .filter(row => !under(row))
    .map(row => ({
      row,
      subagents: rows.filter(other => under(other) === row).sort((a, b) => (a.agent.id < b.agent.id ? -1 : a.agent.id > b.agent.id ? 1 : 0)),
    }))
}

/** How a subagent ended, as the line its main agent was sent says it. */
export type SubagentEnd = { agent: AgentMeta; status: string; detail?: string; rest: string }

/** The line the tool that runs agents sends a run when a run started for it ends: its opening words. */
const ENDED = /^The run (\S+), started for this run, ended (\w+)(?:: (.*?))?\.?$/

/**
 * A prompt as the end of one of the run's subagents, or `undefined` when it is anything else: it
 * opens with the ended line and the run it names is one of these subagents, so a person typing
 * the same words about some other run still reads as a person.
 */
export function subagentEnd(prompt: string, subagents: readonly AgentMeta[]): SubagentEnd | undefined {
  const [first = '', ...more] = prompt.split('\n')
  const match = ENDED.exec(first.trim())
  const agent = match && subagents.find(candidate => candidate.id === match[1])
  if (!match || !agent) return undefined
  return { agent, status: match[2]!, ...(match[3] ? { detail: match[3] } : {}), rest: more.join('\n').trim() }
}

/**
 * When a subagent was started: the moment its id was made from, which never changes. Its card's
 * own start time moves a moment later once its process writes the card in its checkout, and a
 * row placed by that would move with it.
 */
export function subagentStartedAt(agent: Pick<AgentMeta, 'id' | 'startedAt'>): string {
  return startedAtFromAgentId(agent.id) ?? agent.startedAt
}

/**
 * Where each subagent's row goes in a log: before the first event written after the subagent
 * started, by index, or at the log's length when none was. An event with no time is passed over.
 */
export function startedBefore(events: readonly FrameworkEvent[], subagents: readonly AgentMeta[]): Map<number, AgentMeta[]> {
  const rows = new Map<number, AgentMeta[]>()
  for (const agent of subagents) {
    const started = Date.parse(subagentStartedAt(agent))
    const at = events.findIndex(e => e.at !== undefined && Date.parse(e.at) > started)
    const index = at === -1 ? events.length : at
    rows.set(index, [...(rows.get(index) ?? []), agent])
  }
  return rows
}
