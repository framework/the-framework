// How a tool call of the coding agent reads in the chat: a verb, then what it was done to
// ("Read AGENTS.md", "Ran pnpm test"), and how a run of calls sums up ("Ran 2 commands, read 1
// file"). Both drivers say a call as a label and a detail: Claude Code's label is the tool's name
// (Bash, Read, Edit), Codex's is the kind of the item (commandExecution, fileChange), so each has
// its own lines in the one map.

/** What a call did, for counting a run of calls. */
type CallKind = 'command' | 'read' | 'edit' | 'search' | 'other'

export interface ToolCall {
  /** The grey word: what was done. */
  verb: string
  /** The same word while the call is still going on: "Running", "Reading". */
  doing: string
  /** The dark words: what it was done to. A file reads as its name alone. */
  target?: string
  /** The detail as the driver gave it: the whole path, the command. */
  detail?: string
  kind: CallKind
}

const CALLS: Record<string, { verb: string; doing: string; kind: CallKind; file?: true }> = {
  // Claude Code: the tool's name.
  Bash: { verb: 'Ran', doing: 'Running', kind: 'command' },
  Read: { verb: 'Read', doing: 'Reading', kind: 'read', file: true },
  Edit: { verb: 'Edited', doing: 'Editing', kind: 'edit', file: true },
  MultiEdit: { verb: 'Edited', doing: 'Editing', kind: 'edit', file: true },
  NotebookEdit: { verb: 'Edited', doing: 'Editing', kind: 'edit', file: true },
  Write: { verb: 'Wrote', doing: 'Writing', kind: 'edit', file: true },
  Grep: { verb: 'Searched', doing: 'Searching', kind: 'search' },
  Glob: { verb: 'Searched', doing: 'Searching', kind: 'search' },
  WebSearch: { verb: 'Searched the web', doing: 'Searching the web', kind: 'search' },
  WebFetch: { verb: 'Fetched', doing: 'Fetching', kind: 'other' },
  Skill: { verb: 'Used skill', doing: 'Using skill', kind: 'other' },
  Task: { verb: 'Started agent', doing: 'Starting agent', kind: 'other' },
  Agent: { verb: 'Started agent', doing: 'Starting agent', kind: 'other' },
  TodoWrite: { verb: 'Updated todos', doing: 'Updating todos', kind: 'other' },
  // Codex: the kind of the item.
  commandExecution: { verb: 'Ran', doing: 'Running', kind: 'command' },
  fileChange: { verb: 'Edited', doing: 'Editing', kind: 'edit', file: true },
  mcpToolCall: { verb: 'Called', doing: 'Calling', kind: 'other' },
  webSearch: { verb: 'Searched the web', doing: 'Searching the web', kind: 'search' },
}

/** `imageView` reads "Image view"; a name that is already words is left as it is. */
function asWords(label: string): string {
  if (!/^[a-z]+([A-Z][a-z]*)+$/.test(label)) return label
  const words = label.replace(/[A-Z]/g, c => ` ${c.toLowerCase()}`)
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** A path's last part; several paths (Codex names every file of one change) each cut the same way. */
function fileNames(detail: string): string {
  return detail
    .split(', ')
    .map(path => path.replace(/\/+$/, '').split('/').pop() || path)
    .join(', ')
}

/** One call as the chat says it. A label the map does not know is its own verb. */
export function toolCall(label: string, detail?: string): ToolCall {
  const known = CALLS[label]
  const call: ToolCall = { verb: known?.verb ?? asWords(label), doing: known?.doing ?? asWords(label), kind: known?.kind ?? 'other' }
  if (detail !== undefined) {
    call.detail = detail
    call.target = known?.file ? fileNames(detail) : detail
  }
  return call
}

const COUNTED: Record<CallKind, (n: number) => string> = {
  command: n => `ran ${n} ${n === 1 ? 'command' : 'commands'}`,
  read: n => `read ${n} ${n === 1 ? 'file' : 'files'}`,
  edit: n => `edited ${n} ${n === 1 ? 'file' : 'files'}`,
  search: n => `searched ${n} ${n === 1 ? 'time' : 'times'}`,
  other: n => `used ${n} ${n === 1 ? 'tool' : 'tools'}`,
}

/** A run of calls in one line: each kind counted, in the order the kinds first came. */
export function callsSummary(calls: readonly ToolCall[]): string {
  const counts = new Map<CallKind, number>()
  for (const call of calls) counts.set(call.kind, (counts.get(call.kind) ?? 0) + 1)
  const line = [...counts].map(([kind, n]) => COUNTED[kind](n)).join(', ')
  return line.charAt(0).toUpperCase() + line.slice(1)
}
